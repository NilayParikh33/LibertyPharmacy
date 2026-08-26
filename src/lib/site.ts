import { getDb } from "./db";

/**
 * Site content/config — admin-managed, stored in the single-row
 * `site_settings` table (see src/lib/db.ts). Call `getSiteSettings()` from
 * server components; call `invalidateSiteSettingsCache()` after an admin save.
 */
export type SiteSettings = {
  name: string;
  tagline: string;
  address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    county: string;
  };
  phone: string;
  phoneHref: string;
  fax: string;
  email: string;
  hours: Array<{ days: string; hours: string }>;
  mapsUrl: string;
};

interface SettingsRow {
  name: string;
  tagline: string;
  phone: string;
  phone_href: string;
  fax: string;
  email: string;
  address_line1: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_county: string;
  hours_json: string;
  maps_url: string;
}

function fromRow(row: SettingsRow): SiteSettings {
  return {
    name: row.name,
    tagline: row.tagline,
    address: {
      line1: row.address_line1,
      city: row.address_city,
      state: row.address_state,
      zip: row.address_zip,
      county: row.address_county,
    },
    phone: row.phone,
    phoneHref: row.phone_href,
    fax: row.fax,
    email: row.email,
    hours: JSON.parse(row.hours_json),
    mapsUrl: row.maps_url,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __siteSettingsCache: SiteSettings | undefined;
}

/** Reuse one cached copy across requests until an admin save invalidates it. */
export async function getSiteSettings(): Promise<SiteSettings> {
  if (globalThis.__siteSettingsCache) return globalThis.__siteSettingsCache;
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM site_settings WHERE id = 1").get<SettingsRow>();
  if (!row) throw new Error("site_settings row missing — database was not initialized correctly.");
  const settings = fromRow(row);
  globalThis.__siteSettingsCache = settings;
  return settings;
}

export function invalidateSiteSettingsCache(): void {
  globalThis.__siteSettingsCache = undefined;
}

export async function updateSiteSettings(input: SiteSettings): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `UPDATE site_settings SET
        name = ?, tagline = ?, phone = ?, phone_href = ?, fax = ?, email = ?,
        address_line1 = ?, address_city = ?, address_state = ?, address_zip = ?, address_county = ?,
        hours_json = ?, maps_url = ?, updated_at = ?
       WHERE id = 1`
    )
    .run(
      input.name,
      input.tagline,
      input.phone,
      input.phoneHref,
      input.fax,
      input.email,
      input.address.line1,
      input.address.city,
      input.address.state,
      input.address.zip,
      input.address.county,
      JSON.stringify(input.hours),
      input.mapsUrl,
      new Date().toISOString()
    );
  invalidateSiteSettingsCache();
}
