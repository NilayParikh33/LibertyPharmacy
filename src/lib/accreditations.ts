/**
 * Accreditation & certification badges shown in the footer.
 *
 * ---------------------------------------------------------------------------
 * READ BEFORE ADDING AN ENTRY
 * ---------------------------------------------------------------------------
 * Every entry here is a public claim that Liberty Pharmacy currently holds
 * that credential. Only add one when ALL of the following are true:
 *
 *  1. The accreditation is current and in Liberty Pharmacy's own name — not
 *     pending, not lapsed, not held by a partner or supplier.
 *  2. The badge artwork is the official asset issued by the accrediting body
 *     (NABP, LegitScript, etc.). Do not recreate, trace, or redraw the mark —
 *     these logos are trademarked and licensed only to holders, and the
 *     programs specify exact artwork, colours, and minimum sizes.
 *  3. `verifyUrl` points at that body's own verification/lookup page for this
 *     pharmacy. LegitScript and NABP both require the seal to link back to
 *     the live verification record, not to a local copy or a marketing page.
 *
 * Getting the assets: both programs issue badge files and a verification URL
 * through the accredited pharmacy's account portal. Ask the pharmacist-in-
 * charge, who will have the login.
 *
 * Removing an entry the moment a credential lapses is just as important as
 * adding it correctly.
 *
 * Badge files live in `public/accreditations/`. The CSP allows `img-src
 * 'self'` only, so they must be served from this app — not hotlinked from the
 * accrediting body's CDN.
 */

export type Accreditation = {
  id: string;
  /** Accessible name, e.g. "NABP Accredited Compounding Pharmacy". */
  name: string;
  /** Path under public/, e.g. "/accreditations/nabp-compounding.png". */
  badge: string;
  /** Alt text. Describe the badge, e.g. "NABP Accredited Compounding Pharmacy". */
  alt: string;
  /** The accrediting body's verification record for this pharmacy. */
  verifyUrl?: string;
};

/**
 * Empty until the official assets and verification URLs are in hand.
 *
 * While this is empty the footer strip renders nothing in production, so the
 * site never claims a credential it cannot evidence. In `next dev` only, the
 * strip shows neutral placeholder slots so the layout can be worked on.
 */
export const accreditations: Accreditation[] = [];

/**
 * How many placeholder slots to draw in development while `accreditations`
 * is empty. Purely a layout aid — never rendered in a production build.
 */
export const PLACEHOLDER_SLOTS = 2;
