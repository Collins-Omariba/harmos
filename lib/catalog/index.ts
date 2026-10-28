import { localCatalogAdapter } from "@/lib/catalog/adapters/local";

/**
 * The app talks to this adapter, never to a vendor SDK. Swap the exported
 * adapter to move catalog backends without touching comparison or UI code.
 */
export const catalog = localCatalogAdapter;

export * from "@/lib/catalog/types";
