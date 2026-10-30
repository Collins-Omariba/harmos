import { getCatalogAdapter } from "@/lib/catalog/adapters";

/**
 * The app talks to this adapter, never to a vendor SDK. Set
 * HARMOS_CATALOG_ADAPTER=local|octopart|digikey|mouser to move catalog
 * backends without touching comparison or UI code.
 */
export const catalog = getCatalogAdapter();

export * from "@/lib/catalog/types";
