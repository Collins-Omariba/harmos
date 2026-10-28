/**
 * Deterministic BOM arithmetic. All money is integer cents; no floats cross
 * this boundary. The model may quote these totals in prose but must never
 * compute them.
 */

export type BomInputItem = {
  id: string;
  partNumber: string;
  manufacturer: string;
  quantity: number;
  unitPriceCents: number | null;
};

export type BomLine = BomInputItem & {
  lineCents: number | null;
};

export type BomTotals = {
  lines: BomLine[];
  totalCents: number;
  totalUnits: number;
  pricedLines: number;
  unpricedLines: number;
};

export function computeBomTotals(items: BomInputItem[]): BomTotals {
  const lines: BomLine[] = items.map((item) => ({
    ...item,
    lineCents:
      item.unitPriceCents === null ? null : item.quantity * item.unitPriceCents,
  }));

  return {
    lines,
    totalCents: lines.reduce((sum, line) => sum + (line.lineCents ?? 0), 0),
    totalUnits: lines.reduce((sum, line) => sum + line.quantity, 0),
    pricedLines: lines.filter((line) => line.lineCents !== null).length,
    unpricedLines: lines.filter((line) => line.lineCents === null).length,
  };
}

/** Whole dollars-and-cents strings ("12.50", "$12.50") become integer cents. */
export function dollarsToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/^\$/, "");

  if (trimmed === "") {
    return null;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [dollars, cents = ""] = trimmed.split(".");
  return Number(dollars) * 100 + Number((cents + "00").slice(0, 2));
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}
