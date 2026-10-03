/**
 * Which kind of deployment this process is serving.
 *
 * The same code runs in two places: the AWS production deployment (ECS +
 * Amazon RDS, under BAA — the one that holds real patient data) and throwaway
 * demo deployments (e.g. the Render blueprint) with fake data and no mail
 * transport. A few demo conveniences were added for the latter; this module is
 * what keeps them from ever taking effect on the former.
 *
 * The signal is the database itself: a connection to Amazon RDS (or RDS IAM
 * auth, which only exists on RDS) means this is the production deployment.
 * It is deliberately derived from where the data lives rather than from a
 * separate flag, so it cannot be forgotten or mis-set independently of it.
 */

function databaseHost(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when connected to Amazon RDS — the AWS production (PHI) deployment. */
export function isRdsDeployment(): boolean {
  if (process.env.DB_AUTH_MODE === "iam") return true;
  const host = databaseHost();
  return !!host && host.endsWith(".rds.amazonaws.com");
}

/**
 * Whether a DEMO_* escape hatch may take effect. Reads the flag (exact
 * "true" only) and refuses it on the RDS deployment, where it would bypass
 * the emailed second factor for real patients. Refusals are logged once at
 * startup so a mis-set variable is visible rather than silently ignored.
 */
export function demoFlagEnabled(name: "DEMO_LOG_OTP_CODES" | "DEMO_SHOW_OTP_ON_SCREEN"): boolean {
  if (process.env[name] !== "true") return false;
  if (isRdsDeployment()) {
    console.error(
      `[deployment] ${name}=true is IGNORED: this deployment uses Amazon RDS (production patient data). ` +
        "Demo escape hatches never apply here - codes are only ever delivered by email. Remove the variable."
    );
    return false;
  }
  return true;
}
