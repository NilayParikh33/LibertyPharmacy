#!/usr/bin/env bash
# Read-only inventory of resources outside the site's normal footprint.
# Run in AWS CloudShell. Changes nothing.
set -uo pipefail
REGIONS=$(aws ec2 describe-regions --query 'Regions[].RegionName' --output text)
for r in $REGIONS; do
  out=""
  # KMS: customer-managed keys only (AWS-managed aws/* keys are free and can't be deleted)
  for k in $(aws kms list-keys --region "$r" --query 'Keys[].KeyId' --output text 2>/dev/null); do
    d=$(aws kms describe-key --region "$r" --key-id "$k" --query 'KeyMetadata.[KeyManager,KeyState,Description]' --output text 2>/dev/null)
    case "$d" in CUSTOMER*) a=$(aws kms list-aliases --region "$r" --key-id "$k" --query 'Aliases[].AliasName' --output text 2>/dev/null); out+="  KMS key $k | $d | alias: ${a:-none}\n";; esac
  done
  n=$(aws glue get-databases --region "$r" --query 'length(DatabaseList)' --output text 2>/dev/null); [ "${n:-0}" != "0" ] && out+="  Glue databases: $(aws glue get-databases --region "$r" --query 'DatabaseList[].Name' --output text)\n"
  n=$(aws glue get-crawlers --region "$r" --query 'length(Crawlers)' --output text 2>/dev/null); [ "${n:-0}" != "0" ] && out+="  Glue crawlers: $n\n"
  n=$(aws glue get-jobs --region "$r" --query 'length(Jobs)' --output text 2>/dev/null); [ "${n:-0}" != "0" ] && out+="  Glue jobs: $n\n"
  s=$(aws secretsmanager list-secrets --region "$r" --query 'SecretList[].Name' --output text 2>/dev/null); [ -n "$s" ] && out+="  Secrets: $s\n"
  i=$(aws ec2 describe-instances --region "$r" --query 'Reservations[].Instances[?State.Name!=`terminated`].[InstanceId,State.Name]' --output text 2>/dev/null); [ -n "$i" ] && out+="  EC2: $i\n"
  v=$(aws ec2 describe-volumes --region "$r" --query 'Volumes[].[VolumeId,State,Size]' --output text 2>/dev/null); [ -n "$v" ] && out+="  EBS volumes: $(echo $v)\n"
  e=$(aws ec2 describe-addresses --region "$r" --query 'Addresses[].[PublicIp,InstanceId]' --output text 2>/dev/null); [ -n "$e" ] && out+="  Elastic IPs: $(echo $e)\n"
  sn=$(aws ec2 describe-snapshots --owner-ids self --region "$r" --query 'length(Snapshots)' --output text 2>/dev/null); [ "${sn:-0}" != "0" ] && out+="  EBS snapshots: $sn\n"
  db=$(aws rds describe-db-instances --region "$r" --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceStatus]' --output text 2>/dev/null); [ -n "$db" ] && out+="  RDS: $(echo $db)\n"
  rs=$(aws rds describe-db-snapshots --region "$r" --snapshot-type manual --query 'length(DBSnapshots)' --output text 2>/dev/null); [ "${rs:-0}" != "0" ] && out+="  RDS manual snapshots: $rs\n"
  l=$(aws lambda list-functions --region "$r" --query 'Functions[].FunctionName' --output text 2>/dev/null); [ -n "$l" ] && out+="  Lambda: $l\n"
  q=$(aws sqs list-queues --region "$r" --query 'QueueUrls' --output text 2>/dev/null); [ -n "$q" ] && [ "$q" != "None" ] && out+="  SQS: $q\n"
  t=$(aws sns list-topics --region "$r" --query 'Topics[].TopicArn' --output text 2>/dev/null); [ -n "$t" ] && out+="  SNS: $t\n"
  ses=$(aws sesv2 list-email-identities --region "$r" --query 'EmailIdentities[].IdentityName' --output text 2>/dev/null); [ -n "$ses" ] && out+="  SES identities: $ses\n"
  cs=$(aws cloudtrail describe-trails --region "$r" --query 'trailList[?HomeRegion==`'"$r"'`].Name' --output text 2>/dev/null); [ -n "$cs" ] && out+="  CloudTrail: $cs\n"
  [ -n "$out" ] && printf "== %s\n%b" "$r" "$out"
done
echo "S3 buckets: $(aws s3api list-buckets --query 'Buckets[].Name' --output text)"
echo "INVENTORY DONE"
