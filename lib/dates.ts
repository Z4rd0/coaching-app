/** Local-calendar date helpers.
 *
 *  `Date.toISOString().slice(0, 10)` is the wrong tool for "which calendar day
 *  is this?": it converts to UTC first, so local midnight in any UTC+ zone
 *  (Europe/Rome included) reports the *previous* day. Every ISO day-string the
 *  app stores (Session.scheduledDate, ?date= query params, <input type="date">
 *  values) is a local calendar day, so it must be built from local components.
 */
export function toLocalISODate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Parse an ISO day-string ("2026-07-26") as local midnight. Passing it bare to
 *  `new Date()` would parse it as UTC midnight — the mirror image of the bug
 *  above. */
export function fromLocalISODate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

/** Today as an ISO day-string in the user's timezone. */
export function todayISO(): string {
  return toLocalISODate(new Date());
}
