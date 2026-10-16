#!/usr/bin/env bash
# One-time setup, run in AWS CloudShell (us-east-1). Safe to re-run.
#   1. Budget "liberty-monthly-35": $35/month of usage BEFORE credits, emails
#      at 80% and 100% actual, and when the month is forecast to pass 100%.
#   2. Lambda "liberty-billing-summary" + EventBridge rule: emails the monthly
#      bill summary on the 5th of each month (14:00 UTC), after AWS finalises
#      the previous month's invoice.
#   3. SNS topic "liberty-billing-alerts" (email subscription — the recipient
#      must click "Confirm subscription" once) + CloudWatch alarm
#      "liberty-billing-summary-failed": tells them if the summary fails; the
#      function also sends the summary through SNS if SES fails.
set -euo pipefail
EMAIL="${ALERT_EMAIL:-libertypharmacy@gmail.com}"
FROM="${FROM_EMAIL:-noreply@rxlibertypharmacy.com}"
REGION=us-east-1
NAME=liberty-billing-summary
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
DIR=$(cd "$(dirname "$0")" && pwd)

echo "== 1. Budget"
cat > /tmp/budget.json <<JSON
{"BudgetName":"liberty-monthly-35","BudgetLimit":{"Amount":"35","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST",
 "CostTypes":{"IncludeCredit":false,"IncludeRefund":false,"IncludeTax":true,"IncludeSubscription":true,"IncludeRecurring":true,
 "IncludeOtherSubscription":true,"IncludeSupport":true,"IncludeDiscount":true,"IncludeUpfront":true,"UseBlended":false,"UseAmortized":false}}
JSON
notif() { echo "{\"Notification\":{\"NotificationType\":\"$1\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":$2,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$EMAIL\"}]}"; }
if aws budgets describe-budget --account-id "$ACCOUNT" --budget-name liberty-monthly-35 >/dev/null 2>&1; then
  echo "budget already exists"
else
  aws budgets create-budget --account-id "$ACCOUNT" --budget file:///tmp/budget.json \
    --notifications-with-subscribers "[$(notif ACTUAL 80),$(notif ACTUAL 100),$(notif FORECASTED 100)]"
  echo "budget created"
fi

echo "== 2. Alert topic (independent of SES)"
TOPIC_ARN=$(aws sns create-topic --name liberty-billing-alerts --region $REGION --query TopicArn --output text)
if aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" --region $REGION \
     --query "Subscriptions[?Endpoint=='$EMAIL'] | length(@)" --output text | grep -q '^0$'; then
  aws sns subscribe --topic-arn "$TOPIC_ARN" --protocol email --notification-endpoint "$EMAIL" --region $REGION >/dev/null
  echo "subscribed $EMAIL — they must click 'Confirm subscription' in the AWS email"
else
  echo "already subscribed"
fi

echo "== 2b. Role"
aws iam create-role --role-name "$NAME" --assume-role-policy-document \
  '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  >/dev/null 2>&1 && echo "role created" || echo "role exists"
aws iam put-role-policy --role-name "$NAME" --policy-name "$NAME" --policy-document "{
  \"Version\":\"2012-10-17\",\"Statement\":[
   {\"Effect\":\"Allow\",\"Action\":[\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],\"Resource\":\"arn:aws:logs:$REGION:$ACCOUNT:*\"},
   {\"Effect\":\"Allow\",\"Action\":[\"ce:GetCostAndUsage\",\"freetier:GetAccountPlanState\"],\"Resource\":\"*\"},
   {\"Effect\":\"Allow\",\"Action\":\"sns:Publish\",\"Resource\":\"$TOPIC_ARN\"},
   {\"Effect\":\"Allow\",\"Action\":\"ses:SendEmail\",\"Resource\":[\"arn:aws:ses:$REGION:$ACCOUNT:identity/*\",\"arn:aws:ses:$REGION:$ACCOUNT:configuration-set/*\"]}]}"
sleep 10

echo "== 3. Function"
(cd "$DIR" && rm -f /tmp/fn.zip && zip -q /tmp/fn.zip lambda_function.py)
if aws lambda get-function --function-name "$NAME" --region $REGION >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$NAME" --zip-file fileb:///tmp/fn.zip --region $REGION >/dev/null
  aws lambda wait function-updated --function-name "$NAME" --region $REGION
  aws lambda update-function-configuration --function-name "$NAME" --region $REGION \
    --environment "Variables={FROM_EMAIL=$FROM,TO_EMAIL=$EMAIL,TOPIC_ARN=$TOPIC_ARN}" >/dev/null
  echo "function updated"
else
  aws lambda create-function --function-name "$NAME" --region $REGION --runtime python3.13 \
    --handler lambda_function.handler --role "arn:aws:iam::$ACCOUNT:role/$NAME" --zip-file fileb:///tmp/fn.zip \
    --timeout 30 --environment "Variables={FROM_EMAIL=$FROM,TO_EMAIL=$EMAIL,TOPIC_ARN=$TOPIC_ARN}" >/dev/null
  echo "function created"
fi
aws lambda wait function-active-v2 --function-name "$NAME" --region $REGION
# One retry for a passing hiccup, not AWS's default two (avoids repeat emails).
aws lambda put-function-event-invoke-config --function-name "$NAME" --region $REGION --maximum-retry-attempts 1 >/dev/null

echo "== 4. Schedule (5th of each month, 14:00 UTC)"
RULE_ARN=$(aws events put-rule --name "$NAME" --schedule-expression "cron(0 14 5 * ? *)" --region $REGION --query RuleArn --output text)
aws lambda add-permission --function-name "$NAME" --statement-id "$NAME-schedule" --action lambda:InvokeFunction \
  --principal events.amazonaws.com --source-arn "$RULE_ARN" --region $REGION >/dev/null 2>&1 || true
aws events put-targets --rule "$NAME" --region $REGION \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:$ACCOUNT:function:$NAME" >/dev/null
echo "schedule set"

echo "== 4b. Failure alarm"
aws cloudwatch put-metric-alarm --region $REGION --alarm-name "$NAME-failed" \
  --alarm-description "The monthly AWS bill summary email failed. Check Lambda $NAME logs; the official AWS invoice email is unaffected." \
  --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value="$NAME" \
  --statistic Sum --period 3600 --evaluation-periods 1 --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching --alarm-actions "$TOPIC_ARN"
echo "alarm set"

echo "== 5. Test run (sends last month's summary now)"
aws lambda invoke --function-name "$NAME" --region $REGION /tmp/out.json >/dev/null && cat /tmp/out.json && echo
echo "DONE"
