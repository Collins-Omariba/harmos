/**
 * Distributor integration layer. Each distributor (LCSC first, more to come)
 * maps its own product API onto `DistributorPart`; importing copies a row
 * into the local catalog (origin "imported") so scoring and comparisons keep
 * working off local data. The local catalog stays the source of truth.
 */

export type DistributorId = "lcsc";

export type DistributorPriceBreak = {
  breakQuantity: number;
  unitPrice: number;
};

export type DistributorParameter = {
  name: string;
  value: string;
};

export type DistributorPart = {
  distributor: DistributorId;
  /** Distributor's own product code, e.g. LCSC C-number. */
  productCode: string;
  /** Manufacturer part number. */
  mpn: string;
  manufacturer: string;
  description: string;
  /** Distributor category path, most-general first. */
  categoryPath: string[];
  /** Package string, e.g. "SOT-23-5", "0603". */
  packageName: string;
  datasheetUrl: string | null;
  sourceUrl: string;
  imageUrls: string[];
  parameters: DistributorParameter[];
  priceBreaks: DistributorPriceBreak[];
  currency: string;
  inStock: boolean;
  stockAvailable: number | null;
  minimumOrderQuantity: number | null;
};

export type DistributorErrorCode =
  | "missing-credentials"
  | "auth"
  | "rate-limit"
  | "not-found"
  | "network"
  | "bad-response";

export class DistributorError extends Error {
  readonly code: DistributorErrorCode;
  readonly distributor: DistributorId;

  constructor(
    distributor: DistributorId,
    code: DistributorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DistributorError";
    this.distributor = distributor;
    this.code = code;
  }
}
