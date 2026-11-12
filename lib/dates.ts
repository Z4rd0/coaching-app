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

/** True only for a real local calendar day written as YYYY-MM-DD. */
export function isValidLocalISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  // Date normalizes invalid values such as 2026-02-30, so round-trip it.
  return toLocalISODate(fromLocalISODate(iso)) === iso;
}

/** Program week 1 is defined as starting on Monday. */
export function isMondayISODate(iso: string): boolean {
  return isValidLocalISODate(iso) && fromLocalISODate(iso).getDay() === 1;
}

/** Today as an ISO day-string in the user's timezone. */
export function todayISO(): string {
  return toLocalISODate(new Date());
}
