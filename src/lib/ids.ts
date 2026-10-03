/**
 * Parses a route [id] segment as a positive database id, or null.
 *
 * Route params are free text. Passing them straight to a query made
 * non-numeric ids reach Postgres and fail with an unhandled 500 (SEC-008);
 * validating here turns that into a clean 400/404 before any query runs.
 */
export function parseId(raw: string): number | null {
  if (!/^[1-9][0-9]{0,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= 2_147_483_647 ? n : null; // Postgres INTEGER / SERIAL max
}
