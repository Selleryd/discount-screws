"use client";
import { apiFetch } from '@/lib/pages-api';

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Check, ChevronDown, Loader2, Plus, Search, SlidersHorizontal, Sparkles, X, Wrench } from "lucide-react";
import type { CatalogPage, Product } from "@/lib/types";
import "./catalog.css";
import "./catalog-enhanced.css";
import "./search-glow.css";
import CompareTray from "./compare-tray";
import PanZoomPhoto from "./pan-zoom-photo";
import AddToRequestButton from "./add-to-request-button";
import type {Taxonomy} from "./type-explorer";

export interface CatalogViewProps {
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
  initialCategory?: string;
  initialQuery?: string;
  initialGroup?: string;
  initialType?: string;
  onGuide: () => void;
}

const currency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const shortName = (product: Product) => product.name.split(" / ")[0];

function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  return <div className="catalog-card-image">
    {failed || !product.image ? <div className="catalog-image-fallback"><Wrench size={36} strokeWidth={1}/><span>Image unavailable</span></div> : <PanZoomPhoto src={product.image} alt={product.name} loading="lazy" onError={() => setFailed(true)} className="catalog-draggable-photo" compact/>}
    <span className="catalog-image-category">{product.subcategory || product.category}</span>
    <span className="catalog-card-arrow" aria-hidden="true"><ArrowRight size={19}/></span>
  </div>;
}

export function CatalogView({ onOpen, onAdd, initialCategory = "", initialQuery = "", initialGroup = "", initialType = "", onGuide }: CatalogViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [group,setGroup]=useState(initialGroup),[type,setType]=useState(initialType);
  const [taxonomy,setTaxonomy]=useState<Taxonomy|null>(null),[compare,setCompare]=useState<Product[]>([]),[compareNote,setCompareNote]=useState("");
  useEffect(()=>{const c=new AbortController();apiFetch("/api/taxonomy",{signal:c.signal}).then(r=>r.json() as Promise<Taxonomy>).then(d=>setTaxonomy(d)).catch(()=>{});return()=>c.abort()},[]);
  const [material, setMaterial] = useState("");
  const [sort, setSort] = useState("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState<CatalogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);

  useEffect(() => { setCategory(initialCategory); }, [initialCategory]);
  useEffect(() => { setGroup(initialGroup); setType(initialType); }, [initialGroup,initialType]);
  useEffect(() => { setQuery(initialQuery); setSearch(initialQuery); }, [initialQuery]);
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  useEffect(() => () => { controller.current?.abort(); }, []);

  const fetchPage = useCallback(async (cursor: string | null = null, replace = false) => {
    if (busy.current && !replace) return;
    if (replace) { controller.current?.abort(); generation.current += 1; setProducts([]); setPage(null); }
    const requestGeneration = generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "24", sort });
      if (search) { params.set("query", search); params.set("mode", "match"); }
      if (category) params.set("category", category);
      if (group) params.set("group",group);
      if (type) params.set("type",type);
      if (material) params.set("material", material);
      if (cursor) params.set("cursor", cursor);
      const response = await apiFetch(`/api/catalog?${params}`, { signal: requestController.signal });
      const result = await response.json() as Partial<CatalogPage> & { error?: string };
      if (!response.ok) throw new Error(result.error || "We could not load the catalog. Please try again.");
      if (!Array.isArray(result.products) || !result.facets) throw new Error("The catalog response was incomplete. Please try again.");
      if (requestGeneration !== generation.current || requestController.signal.aborted) return;
      const data = result as CatalogPage;
      setProducts((existing) => replace ? data.products : [...new Map([...existing, ...data.products].map((item) => [item.id, item])).values()]);
      setPage(data);
    } catch (reason) {
      if (requestController.signal.aborted || requestGeneration !== generation.current) return;
      setError(reason instanceof Error ? reason.message : "We could not load the catalog. Please try again.");
    } finally {
      if (requestGeneration === generation.current && !requestController.signal.aborted) { busy.current = false; setLoading(false); }
    }
  }, [search, category, material, sort, group, type]);

  useEffect(() => { void fetchPage(null, true); return () => { controller.current?.abort(); busy.current = false; }; }, [fetchPage]);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !page?.nextCursor || loading || error || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void fetchPage(page.nextCursor); }, { rootMargin: "500px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [page?.nextCursor, loading, error, fetchPage]);

  const clearFilters = () => { setQuery(""); setSearch(""); setCategory(""); setMaterial(""); setGroup(""); setType(""); };
  const hasFilters = Boolean(category || material || query || group || type);
  const categoryFacets = page?.facets.categories || [];
  const browseGroups=taxonomy?[...taxonomy.groups,...(taxonomy.collections||[])]:[];
  const chosenGroup=browseGroups.find(g=>g.id===group);
  const chosenType=chosenGroup?.types.find(t=>t.id===type)||browseGroups.flatMap(g=>g.types).find(t=>t.id===type);
  const chooseGroup=(id:string)=>{setGroup(id);setType("");setCategory("");setMaterial("")};
  const toggleCompare=(p:Product)=>{setCompareNote("");if(compare.some(x=>x.id===p.id)){setCompare(compare.filter(x=>x.id!==p.id));return}if(compare.length===3){setCompareNote("Compare up to three parts. Remove one from the tray to add another.");return}setCompare([...compare,p])};
  const materialFacets = page?.facets.materials || [];

  return <div className="catalog-view">
    <section className="catalog-intro">
      <div><p className="eyebrow">THE CATALOG</p><h1>Small parts.<br/><span>Endless possibilities.</span></h1><p className="catalog-intro-copy">From the first prototype to the final build. Find the hardware that holds it all together.</p></div>
      <button className="catalog-guide" onClick={onGuide}><Sparkles size={20} strokeWidth={1.5}/><span><strong>Not sure what it’s called?</strong><small>Describe it. We’ll help you find it.</small></span><ArrowRight size={20}/></button>
    </section>

    <section className="catalog-workspace" aria-label="Product catalog">
      <div className="catalog-search-row">
        <label className="catalog-search"><Search size={21} strokeWidth={1.5}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, size, material or part number" aria-label="Search products"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={17}/></button>}</label>
        <button className={`catalog-filter-toggle ${filtersOpen ? "active" : ""}`} aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18}/><span>Filters{material ? " (1)" : ""}</span></button>
        <label className="catalog-sort"><span className="catalog-sr-only">Sort products</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Recommended</option><option value="name">Name: A to Z</option><option value="price-asc">Pack price: low to high</option><option value="price-desc">Pack price: high to low</option></select><ChevronDown size={15}/></label>
      </div>
      <div className="catalog-categories" aria-label="Filter by hardware family"><button className={!group&&!category ? "active" : ""} onClick={() => chooseGroup("")}>All hardware</button>{taxonomy?.groups.map(g=><button key={g.id} className={group===g.id?'active':''} onClick={()=>chooseGroup(g.id)}>{g.name}<span>{g.skuCount}</span></button>)||categoryFacets.map(item=><button key={item.name} className={category===item.name?'active':''} onClick={()=>setCategory(item.name)}>{item.name}</button>)}</div>
      {chosenType&&<div className="catalog-type-banner"><div><p className="eyebrow">{chosenGroup?.name||'HARDWARE TYPE'}</p><h2>{chosenType.name}</h2><p>{chosenType.description||'Compare sizes and specifications for this hardware type.'}</p></div><button onClick={()=>setType('')}>Explore the family <ArrowRight size={15}/></button></div>}


      <div className="catalog-body">
        <aside className={`catalog-sidebar ${filtersOpen ? "is-open" : ""}`} id="catalog-filters">
          <div className="catalog-filter-heading"><h2>Refine your find</h2><SlidersHorizontal size={16}/></div>
          {chosenGroup&&<fieldset className="catalog-filter-group"><legend>Fastener type</legend><label className="catalog-radio"><input type="radio" name="catalog-type" checked={!type} onChange={()=>setType('')}/><span>All {chosenGroup.name.toLowerCase()}</span></label>{chosenGroup.types.map(t=><label className="catalog-radio" key={t.id}><input type="radio" name="catalog-type" checked={type===t.id} onChange={()=>setType(t.id)}/><span>{t.name}</span><small>{t.skuCount}</small></label>)}</fieldset>}
          <fieldset className="catalog-filter-group"><legend>Material</legend><label className="catalog-radio"><input type="radio" name="catalog-material" checked={!material} onChange={() => setMaterial("")}/><span>All materials</span></label>{materialFacets.map((item) => <label className="catalog-radio" key={item.name}><input type="radio" name="catalog-material" checked={material === item.name} onChange={() => setMaterial(item.name)}/><span>{item.name}</span><small>{item.count}</small></label>)}</fieldset>
          {hasFilters && <button className="catalog-reset" onClick={clearFilters}>Clear all filters <X size={13}/></button>}
          <div className="catalog-help"><span className="catalog-help-icon"><Wrench size={22} strokeWidth={1.25}/></span><h3>A better fit starts here.</h3><p>Not sure about diameter, drive, or thread? Our finder helps narrow it down.</p><button onClick={onGuide}>Find my fastener <ArrowRight size={16}/></button></div>
        </aside>

        <div className="catalog-results">
          <div className="catalog-results-meta" aria-live="polite"><p>{loading && !products.length ? "Finding your hardware…" : <><strong>{(page?.total || 0).toLocaleString()}</strong> {search ? `closest matches for “${search}”` : `${category ? category.toLowerCase() : "products"} to explore`}</>}</p>{page?.coverage && !page.coverage.complete && <span className="catalog-preview-label">Preview catalog</span>}</div>
          {material && <div className="catalog-active-filters"><button onClick={() => setMaterial("")}>{material}<X size={12}/></button></div>}
          <div className="catalog-grid" aria-busy={loading}>
            {products.map((product) => <article className="catalog-card" key={product.id}>
              <button className="catalog-card-main" onClick={() => onOpen(product)} aria-label={`View ${product.name}`}><ProductImage product={product}/><div className="catalog-card-info"><div className="catalog-card-sku">PART {product.sku}</div><h2>{shortName(product)}</h2><p>{[product.drive, product.head, product.material, product.finish].filter(Boolean).join(" · ")}</p></div></button>
              <button className={'catalog-compare-pick '+(compare.some(p=>p.id===product.id)?'selected':'')} aria-pressed={compare.some(p=>p.id===product.id)} onClick={()=>toggleCompare(product)}><span>{compare.some(p=>p.id===product.id)?<Check size={10}/>:<Plus size={10}/>}</span>Compare specifications</button><div className="catalog-card-bottom"><div><strong>{product.price === null ? "Request pricing" : currency(product.price)}</strong><span>{product.packQuantity ? `per ${product.packQuantity.toLocaleString()}-piece pack` : "Pack quantity on request"}</span></div><AddToRequestButton productName={product.name} onAdd={() => onAdd(product)}/></div>
            </article>)}
            {loading && !products.length && Array.from({ length: 6 }, (_, index) => <div className="catalog-skeleton" key={index} aria-hidden="true"><div/><span/><span/><span/></div>)}
          </div>
          {!loading && !error && products.length === 0 && <div className="catalog-empty"><Search size={36} strokeWidth={1}/><h2>Let’s find another angle.</h2><p>{chosenType?`${chosenType.name} is included in our type directory. More individual sizes are being imported. Call 845-499-9269 with the dimensions you need for a sourcing quote.`:"Try fewer details, a different size, or choose another type. Our team can help identify the right specification."}</p><div><button className="btn btn-dark" onClick={clearFilters}>Reset search</button><button className="btn btn-outline" onClick={onGuide}>Try the finder <ArrowRight size={16}/></button></div></div>}
          {error && <div className="catalog-error" role="alert"><p>{error}</p><button className="btn btn-outline" onClick={() => void fetchPage(page?.nextCursor || null, !products.length)}>Try again</button></div>}
          <div className="catalog-load-area" ref={sentinel}>{loading && products.length > 0 ? <span><Loader2 className="catalog-spinner" size={18}/> Loading more hardware</span> : page?.nextCursor && !error ? <button onClick={() => void fetchPage(page.nextCursor)}><ArrowDown size={16}/> Load more products</button> : products.length > 0 && !error ? <span>You’ve explored all {page?.total.toLocaleString()} matching products.</span> : null}</div>
          {page?.coverage && !page.coverage.complete && <p className="catalog-coverage-note">This preview includes {page.coverage.imported.toLocaleString()} imported products. The complete catalog is still being connected. Prices are reference prices; availability and final pricing are confirmed with your quote.</p>}
        </div>
      </div>
    </section>
    {compareNote&&<p className="compare-notice" role="status">{compareNote}<button aria-label="Dismiss comparison notice" onClick={()=>setCompareNote('')}><X size={13}/></button></p>}
    <CompareTray products={compare} onRemove={id=>setCompare(compare.filter(p=>p.id!==id))} onClear={()=>setCompare([])} onOpen={onOpen}/>
  </div>;
}

export default CatalogView;
