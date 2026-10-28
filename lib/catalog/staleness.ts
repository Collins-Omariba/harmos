/**
 * Hand-entered catalog rows rot silently unless the UI says so. Anything older
 * than STALE_AFTER_MONTHS gets a visible warning next to the source link.
 */

export const STALE_AFTER_MONTHS = 12;

export function sourceAgeMonths(
  retrievedAt: string,
  now: Date = new Date(),
): number | null {
  const retrieved = new Date(retrievedAt);

  if (Number.isNaN(retrieved.getTime())) {
    return null;
  }

  const months =
    (now.getUTCFullYear() - retrieved.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - retrieved.getUTCMonth());

  return Math.max(0, months);
}

export function sourceAgeLabel(
  retrievedAt: string,
  now: Date = new Date(),
): string {
  const months = sourceAgeMonths(retrievedAt, now);

  if (months === null) {
    return "source date unknown";
  }
  if (months === 0) {
    return "sourced this month";
  }
  return `sourced ${months} mo ago`;
}

export function isSourceStale(
  retrievedAt: string,
  now: Date = new Date(),
): boolean {
  const months = sourceAgeMonths(retrievedAt, now);
  return months !== null && months > STALE_AFTER_MONTHS;
}
