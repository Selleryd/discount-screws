export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory?: string;
  diameter?: string;
  length?: string;
  material?: string;
  finish?: string;
  head?: string;
  drive?: string;
  price: number | null;
  packQuantity: number | null;
  image: string;
  specs: Record<string, string>;
  sourceUrl: string;
  unitPrice?: number;
  priceStatus?: string;
  retrievedAt?: string;
  imageDisclaimer?: string;
  availability?: string;
  sourceAvailability?: string;
  pricingTiers?: { cartons: string; price: number; packQuantity: number }[];
  sourceImage?: string;
}

export interface CatalogCoverage {
  discovered: number;
  imported: number;
  complete: boolean;
  notes: string;
  source: string;
  fetchedAt: string;
  discoveredBasis?: string;
  enumerationComplete?: boolean;
  sourceAdvertisedMinimum?: number;
  sourceAdvertisedCountLabel?: string;
  notesDetails?: string[];
}

export interface CatalogQuery {
  query?: string;
  category?: string;
  group?: string;
  type?: string;
  subcategory?: string;
  material?: string;
  cursor?: string;
  limit?: number;
  mode?: "catalog" | "match";
  sort?: "relevance" | "price-asc" | "price-desc" | "name";
}

export interface CatalogPage {
  products: Product[];
  total: number;
  nextCursor: string | null;
  facets: { categories: { name: string; count: number }[]; materials: { name: string; count: number }[]; subcategories?: { name: string; count: number }[] };
  filters?: { group: string | null; type: string | null; subcategory: string | null; category: string | null };
  coverage: CatalogCoverage;
  source: "database" | "catalog-snapshot";
}

export interface OrderItem { id: string; quantity: number }
export interface OrderCustomer { name?: string; email?: string; phone?: string; notes?: string }

export interface TaxonomyType {
  id:string;
  name:string;
  sourceUrl?:string;
  url?:string;
  description?:string;
  image?:string;
  productIds:string[];
  skuCount?:number;
  imported?:boolean;
  importStatus?:string;
}
export interface TaxonomyGroup {
  id:string;
  name:string;
  sourceUrl?:string;
  url?:string;
  description?:string;
  image?:string;
  types:TaxonomyType[];
  skuCount?:number;
}
export interface CatalogTaxonomy {
  groups:TaxonomyGroup[];
  collections?:TaxonomyGroup[];
  complete:boolean;
  notes?:unknown;
  coverage?:unknown;
  importedProductCount?:number;
  mappedProductCount?:number;
  totalTypeCount?:number;
  uniqueTypeCount?:number;
  source?:"database"|"catalog-snapshot";
}
