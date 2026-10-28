import type { CatalogPart } from "@/lib/catalog/types";

/**
 * Maps a catalog row onto a new project component. Quantity always starts at
 * 1 (edited afterwards); the indicative catalog price becomes the opening
 * unit price, editable like any other BOM field.
 */
export type CatalogComponentInput = {
  partNumber: string;
  manufacturer: string;
  package: string;
  datasheetUrl: string | null;
  notes: string | null;
  quantity: number;
  unitPriceCents: number | null;
};

export function catalogToComponentInput(
  part: CatalogPart,
  quantity: number,
): CatalogComponentInput {
  return {
    partNumber: part.partNumber,
    manufacturer: part.manufacturer,
    package: part.package,
    datasheetUrl: part.datasheetUrl || null,
    notes: part.description,
    quantity: Math.max(0, Math.floor(quantity)),
    unitPriceCents:
      part.priceUsd === null ? null : Math.round(part.priceUsd * 100),
  };
}
