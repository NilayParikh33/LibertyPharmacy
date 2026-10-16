#!/usr/bin/env bash
# One-time setup, run in AWS CloudShell (us-east-1). Safe to re-run.
#   1. Budget "liberty-monthly-35": $35/month of usage BEFORE credits, emails
#      at 80% and 100% actual, and when the month is forecast to pass 100%.
#   2. Lambda "liberty-billing-summary" + EventBridge rule: emails the monthly
#      bill summary on the 2nd of each month (14:00 UTC).
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

echo "== 2. Role"
aws iam create-role --role-name "$NAME" --assume-role-policy-document \
  '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
  >/dev/null 2>&1 && echo "role created" || echo "role exists"
aws iam put-role-policy --role-name "$NAME" --policy-name "$NAME" --policy-document "{
  \"Version\":\"2012-10-17\",\"Statement\":[
   {\"Effect\":\"Allow\",\"Action\":[\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],\"Resource\":\"arn:aws:logs:$REGION:$ACCOUNT:*\"},
   {\"Effect\":\"Allow\",\"Action\":[\"ce:GetCostAndUsage\",\"freetier:GetAccountPlanState\"],\"Resource\":\"*\"},
   {\"Effect\":\"Allow\",\"Action\":\"ses:SendEmail\",\"Resource\":[\"arn:aws:ses:$REGION:$ACCOUNT:identity/*\",\"arn:aws:ses:$REGION:$ACCOUNT:configuration-set/*\"]}]}"
sleep 10

echo "== 3. Function"
(cd "$DIR" && rm -f /tmp/fn.zip && zip -q /tmp/fn.zip lambda_function.py)
if aws lambda get-function --function-name "$NAME" --region $REGION >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$NAME" --zip-file fileb:///tmp/fn.zip --region $REGION >/dev/null
  aws lambda wait function-updated --function-name "$NAME" --region $REGION
  aws lambda update-function-configuration --function-name "$NAME" --region $REGION \
    --environment "Variables={FROM_EMAIL=$FROM,TO_EMAIL=$EMAIL}" >/dev/null
  echo "function updated"
else
  aws lambda create-function --function-name "$NAME" --region $REGION --runtime python3.13 \
    --handler lambda_function.handler --role "arn:aws:iam::$ACCOUNT:role/$NAME" --zip-file fileb:///tmp/fn.zip \
    --timeout 30 --environment "Variables={FROM_EMAIL=$FROM,TO_EMAIL=$EMAIL}" >/dev/null
  echo "function created"
fi
aws lambda wait function-active-v2 --function-name "$NAME" --region $REGION

echo "== 4. Schedule (2nd of each month, 14:00 UTC)"
RULE_ARN=$(aws events put-rule --name "$NAME" --schedule-expression "cron(0 14 2 * ? *)" --region $REGION --query RuleArn --output text)
aws lambda add-permission --function-name "$NAME" --statement-id "$NAME-schedule" --action lambda:InvokeFunction \
  --principal events.amazonaws.com --source-arn "$RULE_ARN" --region $REGION >/dev/null 2>&1 || true
aws events put-targets --rule "$NAME" --region $REGION \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:$ACCOUNT:function:$NAME" >/dev/null
echo "schedule set"

echo "== 5. Test run (sends last month's summary now)"
aws lambda invoke --function-name "$NAME" --region $REGION /tmp/out.json >/dev/null && cat /tmp/out.json && echo
echo "DONE"
