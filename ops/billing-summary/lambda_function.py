"""
Monthly AWS bill summary for Liberty Pharmacy, emailed on the 2nd of each month.

Runs as the Lambda function `liberty-billing-summary` (us-east-1), triggered by
the EventBridge rule of the same name on the 5th (after AWS finalises the
previous month's invoice). Set up by ./setup.sh.

Reliability: if SES can't send, the same summary is published to the SNS topic
`liberty-billing-alerts` (email subscription, independent of SES). Any other
failure trips the CloudWatch alarm `liberty-billing-summary-failed`, which also
notifies that topic. This email is a summary; AWS charges the card on file
automatically and emails the official PDF invoice.

Reports for the month that just ended:
  - AWS usage before credits (what the month really cost)
  - credits applied
  - the amount to pay (after credits)
  - credits left, when AWS exposes it (Free Tier plan API), and how long they last
  - the top services by cost

Sends through Amazon SES from FROM_EMAIL to TO_EMAIL (while SES is in its
sandbox, TO_EMAIL must be a verified address). Contains no patient data.
"""

import datetime
import os

import boto3

ce = boto3.client("ce", region_name="us-east-1")
ses = boto3.client("sesv2", region_name="us-east-1")


def _money(v):
    return f"${v:,.2f}"


def _credits_left():
    """Remaining promotional credits, or None if this account/API can't tell."""
    try:
        state = boto3.client("freetier", region_name="us-east-1").get_account_plan_state()
        left = state.get("accountPlanRemainingCredits") or {}
        return float(left["amount"]) if "amount" in left else None
    except Exception as err:  # older SDK, not on a Free Tier plan, or no access
        print(f"credits left unavailable: {err}")
        return None


def handler(event, context):
    today = datetime.date.today()
    first_this = today.replace(day=1)
    first_last = (first_this - datetime.timedelta(days=1)).replace(day=1)
    period = {"Start": first_last.isoformat(), "End": first_this.isoformat()}
    month_name = first_last.strftime("%B %Y")

    by_type = ce.get_cost_and_usage(
        TimePeriod=period,
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "RECORD_TYPE"}],
    )["ResultsByTime"][0]["Groups"]
    amounts = {g["Keys"][0]: float(g["Metrics"]["UnblendedCost"]["Amount"]) for g in by_type}
    credits_applied = -sum(v for k, v in amounts.items() if k in ("Credit", "Refund") and v < 0)
    usage = sum(v for k, v in amounts.items() if k not in ("Credit", "Refund"))
    to_pay = max(0.0, round(usage - credits_applied, 2))

    services = ce.get_cost_and_usage(
        TimePeriod=period,
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
        Filter={"Not": {"Dimensions": {"Key": "RECORD_TYPE", "Values": ["Credit", "Refund"]}}},
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )["ResultsByTime"][0]["Groups"]
    top = sorted(
        ((g["Keys"][0], float(g["Metrics"]["UnblendedCost"]["Amount"])) for g in services),
        key=lambda x: -x[1],
    )
    top = [(name, cost) for name, cost in top if cost >= 0.01][:6]

    left = _credits_left()
    if left is None:
        left_line = "Credits left: see Billing → Credits in the AWS console"
        runway = ""
    else:
        left_line = f"Credits left: {_money(left)}"
        runway = (
            f"At this month's rate, credits last about {left / usage:.1f} more months."
            if usage > 0
            else ""
        )

    lines = [
        f"Liberty Pharmacy — AWS bill for {month_name}",
        "",
        f"AWS usage (before credits): {_money(usage)}",
        f"Credits applied:            -{_money(credits_applied)}",
        f"Amount you pay:             {_money(to_pay)}",
        "",
        left_line,
    ]
    if runway:
        lines.append(runway)
    lines += ["", "Top services:"] + [f"  {name}: {_money(cost)}" for name, cost in top]
    lines += [
        "",
        "AWS charges the card on file automatically; you don't pay from this email.",
        "The official invoice (PDF) is emailed separately by AWS.",
        "A budget alert emails this address if monthly usage passes $35.",
        "Details: AWS console → Billing and Cost Management → Bills.",
    ]
    body = "\n".join(lines)
    print(body)

    subject = f"AWS bill {month_name}: you pay {_money(to_pay)} (usage {_money(usage)})"
    try:
        ses.send_email(
            FromEmailAddress=os.environ["FROM_EMAIL"],
            Destination={"ToAddresses": [os.environ["TO_EMAIL"]]},
            Content={"Simple": {"Subject": {"Data": subject}, "Body": {"Text": {"Data": body}}}},
        )
    except Exception as err:
        # SES down, sandboxed or misconfigured: deliver through SNS instead,
        # then fail so the CloudWatch alarm also flags that SES needs a look.
        print(f"SES send failed, falling back to SNS: {err}")
        boto3.client("sns", region_name="us-east-1").publish(
            TopicArn=os.environ["TOPIC_ARN"],
            Subject=subject[:100],
            Message=body + f"\n\n(Sent via AWS notifications because the normal email failed: {err})",
        )
        raise
    return {"month": month_name, "usage": usage, "credits": credits_applied, "to_pay": to_pay, "credits_left": left}
