import type { Product, OrderItem, OrderCustomer } from "./types";

const STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "can", "find", "for", "from", "give", "i", "in", "inch", "inches", "is", "it", "like", "looking", "me", "my", "need", "of", "on", "or", "please", "some", "that", "the", "these", "this", "to", "want", "with", "would", "you"]);
const SYNONYMS: Record<string,string> = { philips: "phillips", allen: "hex", star: "torx", rustproof: "stainless", rustresistant: "stainless", ss: "stainless", bolts: "bolt", screws: "screw", washers: "washer", nuts: "nut" };

export function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[“”″]/g, '"').replace(/[’′]/g, "'").replace(/[×]/g, "x").replace(/\b(?:6[ -]?lobe|six[ -]?lobe)\b/g,"torx").replace(/\bflathead\b/g,"flat head").replace(/\bpanhead\b/g,"pan head").replace(/\bselftapping\b/g,"self-tapping").replace(/\bselfdrilling\b/g,"self-drilling").replace(/\bstainless\s+steel\b/g, "stainless").replace(/\brust[ -]resistant\b/g, "rustresistant").replace(/[^a-z0-9./#" -]+/g, " ").replace(/\s+/g, " ").trim();
}
export function searchTokens(value: string): string[] {
  return [...new Set(normalizeSearch(value).split(/[\s]+/).map((term) => term.replace(/^[-.]+|[-.]+$/g, "")).filter((term) => term && !STOP_WORDS.has(term) && term !== "x").map((term) => SYNONYMS[term] || term.replace(/^#(?=\d)/, "")))].slice(0, 12);
}
export function productSearchText(product: Product): string {
  const values = [product.sku, product.name, product.category, product.subcategory, product.diameter, product.length, product.material, product.finish, product.head, product.drive, ...Object.values(product.specs)];
  return normalizeSearch(values.filter(Boolean).join(" "));
}
export function comparableDimension(value:string):string { return value.toLowerCase().replace(/inches|inch/g, "").replace(/["#\s]/g, ""); }
export function searchDimensions(value:string):{diameter?:string;length?:string} {
  const query=normalizeSearch(value);
  const pair=query.match(/(#\s*\d+|m\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?|\d+\/\d+(?:-\d+)?|\d+-\d+)\s*(?:x|by)\s*(\d+(?:[- ]\d+\/\d+|\/\d+|\.\d+)?)\s*(mm|inches|inch|in|")?/i);
  const diameter=pair?.[1] || query.match(/#\s*\d+\b|\b\d+\/\d+-\d+\b|\bm\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?/i)?.[0];
  const explicitLength=query.match(/(?:length|long)\s*(?:of)?\s*(\d+(?:[- ]\d+\/\d+|\/\d+|\.\d+)?)\s*(mm|inches|inch|in|")?/i) || query.match(/(\d+(?:[- ]\d+\/\d+|\/\d+|\.\d+)?)\s*(mm|inches|inch|in|")?\s*long/i);
  let length=pair?.[2] || explicitLength?.[1];
  const unit=pair?.[3] || explicitLength?.[2];
  if(length&&(unit==="mm"||(!unit&&diameter?.toLowerCase().startsWith("m"))))length+="mm";
  return {diameter:diameter?comparableDimension(diameter):undefined,length:length?comparableDimension(length):undefined};
}
export function rankProduct(product: Product, tokens: string[],query=tokens.join(" ")): number {
  if (!tokens.length) return 0;
  const text = productSearchText(product);
  const title = normalizeSearch(product.name);
  const sku = normalizeSearch(product.sku);
  let score = 0;
  for (const token of tokens) {
    if (sku === token) score += 100;
    if (title.includes(token)) score += 8;
    if (text.includes(token)) score += 3;
  }
  if (tokens.every((token) => text.includes(token))) score += 20;
  const dimensions=searchDimensions(query);
  if(dimensions.diameter&&product.diameter)score+=comparableDimension(product.diameter)===dimensions.diameter?60:-30;
  if(dimensions.length&&product.length)score+=comparableDimension(product.length)===dimensions.length?40:-20;
  return score;
}
export function validateProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const p = value as Product;
  if(!["subcategory","diameter","length","material","finish","head","drive"].every((key)=>{const value=(p as unknown as Record<string,unknown>)[key];return value===undefined || (typeof value==="string" && value.length<=500);})) return false;
  if(!["priceStatus","retrievedAt","imageDisclaimer","availability","sourceAvailability","sourceImage"].every((key)=>{const value=(p as unknown as Record<string,unknown>)[key];return value===undefined||(typeof value==="string"&&value.length<=2000);}))return false;
  if(p.unitPrice!==undefined&&(!Number.isFinite(p.unitPrice)||p.unitPrice<0))return false;
  if(p.pricingTiers!==undefined&&(!Array.isArray(p.pricingTiers)||p.pricingTiers.length>30||!p.pricingTiers.every((tier)=>tier&&typeof tier.cartons==="string"&&tier.cartons.length<=50&&Number.isFinite(tier.price)&&tier.price>=0&&Number.isInteger(tier.packQuantity)&&tier.packQuantity>0)))return false;
  if(typeof p.image!=="string" || !(p.image.startsWith("https://") || /^\/(?:discount-screws\/)?catalog-images\//.test(p.image))) return false;
  return typeof p.id === "string" && p.id.length > 0 && p.id.length <= 160 && typeof p.sku === "string" && typeof p.name === "string" && p.name.length > 0 && p.name.length <= 500 && typeof p.category === "string" && p.category.length <= 120 && typeof p.image === "string" && typeof p.sourceUrl === "string" && p.sourceUrl.length <= 2000 && p.sourceUrl.startsWith("https://www.fastenersuperstore.com/") && (p.price === null || (Number.isFinite(p.price) && p.price >= 0)) && (p.packQuantity === null || (Number.isInteger(p.packQuantity) && p.packQuantity > 0)) && !!p.specs && typeof p.specs === "object" && !Array.isArray(p.specs) && Object.keys(p.specs).length <= 100 && Object.values(p.specs).every((v) => typeof v === "string" && v.length <= 1000);
}
export function validateOrderItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new Error("Please include 1 to 50 products in your request.");
  const merged = new Map<string, number>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || raw.id.length > 160 || !Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 100000) throw new Error("Each item needs a valid product and a quantity between 1 and 100,000 packs.");
    const quantity = (merged.get(raw.id) || 0) + raw.quantity;
    if (quantity > 100000) throw new Error("The maximum quantity is 100,000 packs per product.");
    merged.set(raw.id, quantity);
  }
  return [...merged].map(([id, quantity]) => ({ id, quantity }));
}
function cleanCustomer(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0,max) : "";
}
export function normalizeCustomer(value: unknown): OrderCustomer {
  const c = value && typeof value === "object" ? value as OrderCustomer : {};
  return { name: cleanCustomer(c.name,100), email: cleanCustomer(c.email,200), phone: cleanCustomer(c.phone,40), notes: cleanCustomer(c.notes,2000) };
}
export function getReferencePackPrice(product:Product,quantity:number):number|null {
  if(!Number.isInteger(quantity)||quantity<1)return null;
  const base=typeof product.price==="number"&&Number.isFinite(product.price)&&product.price>=0?product.price:null;
  if(!product.packQuantity)return base;
  const matching=(product.pricingTiers||[]).flatMap((tier)=>{
    if(tier.packQuantity!==product.packQuantity||!Number.isFinite(tier.price)||tier.price<0)return [];
    const label=tier.cartons.trim().replace(/[–—]/g,"-").replace(/\s/g,"");
    const range=label.match(/^(\d+)-(\d+)$/),plus=label.match(/^(\d+)\+$/),single=label.match(/^(\d+)$/);
    const min=range?Number(range[1]):plus?Number(plus[1]):single?Number(single[1]):NaN;
    const max=range?Number(range[2]):plus?Infinity:single?Number(single[1]):NaN;
    return min>=1&&max>=min&&quantity>=min&&quantity<=max?[{price:tier.price,min,max}]:[];
  }).sort((a,b)=>b.min-a.min||a.max-b.max);
  return matching[0]?.price??base;
}
export function formatOrder(items: OrderItem[], products: Product[], customer: OrderCustomer): { text: string; subtotal: number | null } {
  const byId = new Map(products.map((p) => [p.id, p]));
  let subtotal = 0;
  let allPriced = true;
  const lines = items.map((item, index) => {
    const p = byId.get(item.id);
    if (!p) throw new Error("A selected product is no longer available. Please refresh your request.");
    const packPrice=getReferencePackPrice(p,item.quantity);
    if (packPrice === null) allPriced = false;
    else subtotal += packPrice * item.quantity;
    const availability=p.sourceAvailability==="out-of-stock"?"\n   Source marked out of stock; please confirm availability.":"";
    return `${index + 1}. ${p.name}${availability}\n   SKU: ${p.sku} | ${item.quantity} ${item.quantity === 1 ? "pack" : "packs"}${p.packQuantity ? ` × ${p.packQuantity.toLocaleString("en-US")} pieces` : " (pack size to confirm)"}${packPrice !== null ? `\n   Listed reference: $${packPrice.toFixed(2)} / pack${packPrice!==p.price?" (quantity tier)":""}` : "\n   Price: please quote"}`;
  });
  const parts = ["DISCOUNTSCREWS · ORDER REQUEST", "Please confirm pricing, availability, shipping and specifications for:", ...lines];
  if (allPriced) parts.push(`Reference subtotal: $${subtotal.toFixed(2)} (before shipping/tax; subject to confirmation)`);
  if (customer.name) parts.push(`Name: ${customer.name}`);
  if (customer.email) parts.push(`Email: ${customer.email}`);
  if (customer.phone) parts.push(`Phone: ${customer.phone}`);
  if (customer.notes) parts.push(`Notes: ${customer.notes}`);
  parts.push("This is a quote/order request, not a completed purchase. Please confirm the exact dimensions before fulfillment.");
  return { text: parts.join("\n\n"), subtotal: allPriced ? Math.round(subtotal * 100) / 100 : null };
}
export function normalizeWhatsAppNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const number = value.trim().replace(/[+\s()-]/g, "");
  return /^[1-9][0-9]{7,14}$/.test(number) ? number : null;
}
