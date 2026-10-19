'use client';
import { appPath, sitePath } from '@/lib/pages-path';
import { apiFetch } from '@/lib/pages-api';
import {useState,useEffect,type ReactNode} from 'react';
import {ArrowUpRight,ArrowRight,Search,Camera,Upload,X,Menu,ShoppingBag,Check,Truck,Box,ScanLine,Focus,MessageCircle,PackageCheck,Loader2} from 'lucide-react';
import type {Product} from '@/lib/types';
import {homeProducts} from './home-data';
import CatalogView from './catalog-view';
import ProductView from './product-view';
import InfoPage from './info-page';
import OrderDrawer from './order-drawer';
import AddToRequestButton from './add-to-request-button';
import LiveHero from './live-hero';
import ProjectNavigator from './project-navigator';
import './design-polish.css';
import PanZoomPhoto from './pan-zoom-photo';
import './cinematic-polish.css';
import ToolsHub, {ToolsSpotlight} from './tools-hub';
import './site-structure.css';
import TypeExplorer from './type-explorer';
import {readPageAnchor,usePageScroll} from './page-scroll';
type Item={product:Product;quantity:number};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
function Logo(){return <a className="logo" href={sitePath("/")} aria-label="DiscountScrews home"><span className="logo-mark"><i/><i/><i/></span><span className="logo-word-discount">discount</span><span className="logo-word-screws">screws</span><sup className="logo-registered" aria-hidden="true">®</sup></a>}
function SiteLink({href,onNavigate,active,children}:{href:string;onNavigate:()=>void;active?:boolean;children:ReactNode}){return <a href={sitePath(href)} aria-current={active?'page':undefined} onClick={e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;e.preventDefault();onNavigate()}}>{children}</a>}
export default function Storefront({initialPage='home',initialProductId,initialProduct}:{initialPage?:string;initialProductId?:string;initialProduct?:Product|null}){
 const [page,setPage]=useState(initialPage),[product,setProduct]=useState<Product|null>(initialProduct||null),[productLoading,setProductLoading]=useState(!!initialProductId&&!initialProduct),[productError,setProductError]=useState('');
 const [menu,setMenu]=useState(false),[cartOpen,setCartOpen]=useState(false),[cart,setCart]=useState<Item[]>([]),[hydrated,setHydrated]=useState(false),[toast,setToast]=useState('');
 const [group,setGroup]=useState(''),[type,setType]=useState('');
 const [category,setCategory]=useState(''),[query,setQuery]=useState('');
 const requestPageScroll=usePageScroll();
 useEffect(()=>{try{const data=JSON.parse(localStorage.getItem('ds-order-v1')||'[]');if(Array.isArray(data))setCart(data.filter((x:any)=>x?.product?.id&&Number.isInteger(x.quantity)&&x.quantity>0).slice(0,100));}catch{}setHydrated(true);const url=new URL(location.href);setQuery(url.searchParams.get('q')||'');setCategory(url.searchParams.get('category')||'');setGroup(url.searchParams.get('group')||'');setType(url.searchParams.get('type')||'');},[]);
 useEffect(()=>{if(hydrated){try{localStorage.setItem('ds-order-v1',JSON.stringify(cart))}catch{}}},[cart,hydrated]);
 useEffect(()=>{
  if(!initialProductId||initialProduct)return;
  const request=new AbortController(),route='/product/'+encodeURIComponent(initialProductId);
  const isCurrent=()=>!request.signal.aborted&&appPath(location.pathname).replace(/\/+$/, '')===route;
  apiFetch('/api/products/'+encodeURIComponent(initialProductId),{signal:request.signal})
   .then(response=>{if(!response.ok)throw Error('This part could not be found.');return response.json() as Promise<{product:Product}>})
   .then(data=>{if(isCurrent())setProduct(data.product)})
   .catch(error=>{if(isCurrent())setProductError(error.message)})
   .finally(()=>{if(isCurrent())setProductLoading(false)});
  return()=>request.abort();
 },[initialProductId,initialProduct]);
 useEffect(()=>{
  let controller:AbortController|null=null;
  const pop=()=>{
   controller?.abort();
   const route=appPath(location.pathname),parts=route.split('/').filter(Boolean);
   const u=new URL(location.href);
   setPage(parts[0]||'home');setProduct(null);setProductError('');setMenu(false);requestPageScroll(readPageAnchor());
   setQuery(u.searchParams.get('q')||'');setCategory(u.searchParams.get('category')||'');setGroup(u.searchParams.get('group')||'');setType(u.searchParams.get('type')||'');
   if(parts[0]!=='product'||!parts[1]){setProductLoading(false);return}
   const request=new AbortController();controller=request;setProductLoading(true);
   apiFetch('/api/products/'+encodeURIComponent(parts[1]),{signal:request.signal})
    .then(async response=>{if(!response.ok)throw Error('This part could not be found.');return response.json() as Promise<{product:Product}>})
    .then(data=>{if(!request.signal.aborted&&appPath(location.pathname)===route)setProduct(data.product)})
    .catch(error=>{if(!request.signal.aborted&&appPath(location.pathname)===route)setProductError(error.message)})
    .finally(()=>{if(!request.signal.aborted&&appPath(location.pathname)===route)setProductLoading(false)});
  };
  window.addEventListener('popstate',pop);
  return()=>{controller?.abort();window.removeEventListener('popstate',pop)};
 },[requestPageScroll]);
 useEffect(()=>{document.body.style.overflow=cartOpen||menu?'hidden':'';return()=>{document.body.style.overflow=''}},[cartOpen,menu]);
 useEffect(()=>{if(!menu)return;const previous=document.activeElement as HTMLElement|null;const first=document.querySelector<HTMLButtonElement>('.mobile-menu .close-menu');first?.focus({preventScroll:true});const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false);if(e.key==='Tab'){const nodes=Array.from(document.querySelectorAll<HTMLElement>('.mobile-menu button,.mobile-menu a'));if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes[nodes.length-1]?.focus()}else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0]?.focus()}}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);previous?.focus({preventScroll:true})}},[menu]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target)}})},{threshold:.08});const nodes=document.querySelectorAll('.section-heading,.build-smarter-title,.build-smarter-links,.connection-banner>div,.process-grid>div');nodes.forEach(n=>{n.classList.add('reveal-ready');observer.observe(n)});return()=>{observer.disconnect();nodes.forEach(n=>n.classList.remove('reveal-ready'))}},[page]);
 useEffect(()=>{const names:Record<string,string>={home:'Small hardware. Big possibilities.',catalog:'The Fastener Catalog',types:'All Fastener Types',tools:'Tools & Fastener Guides',about:'Our Story',contact:'Contact Discount Screws',faq:'Questions, Answered','bulk-orders':'Bulk & Business Orders',materials:'Materials & Finishes',measuring:'Fastener Measuring Center',guide:'The Fastener Field Guide',shipping:'Shipping & Ordering',returns:'Returns & Order Changes',applications:'Hardware for Your Next Build',privacy:'Privacy',terms:'Ordering Terms'};const title=(page==='product'&&product?product.name:names[page]||'Find Your Hardware')+' | DiscountScrews';document.title=title;const url=location.origin+sitePath(page==='home'?'/':page==='product'&&product?'/product/'+encodeURIComponent(product.id):'/'+page);let canonical=document.querySelector<HTMLLinkElement>('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=url;const ogTitle=document.querySelector<HTMLMetaElement>('meta[property="og:title"]');if(ogTitle)ogTitle.content=title;const ogUrl=document.querySelector<HTMLMetaElement>('meta[property="og:url"]');if(ogUrl)ogUrl.content=url},[page,product]);
 const navigate=(p:string,anchor:string|null=null)=>{setPage(p);setProduct(null);setMenu(false);window.history.pushState({},'',sitePath(p==='home'?'/':'/'+p));requestPageScroll(anchor)};
 const browse=(c='',q='',g='',t='')=>{setCategory(c);setQuery(q);setGroup(g);setType(t);navigate('catalog');const s=new URLSearchParams();if(c)s.set('category',c);if(q)s.set('q',q);if(g)s.set('group',g);if(t)s.set('type',t);window.history.replaceState({},'',sitePath('/catalog')+(s.size?'?'+s:''))};
 const open=(p:Product)=>{setProduct(p);setProductLoading(false);setPage('product');window.history.pushState({},'',sitePath('/product/'+encodeURIComponent(p.id)));setMenu(false);requestPageScroll()};
 const add=(p:Product,n=1)=>{setCart(old=>old.some(i=>i.product.id===p.id)?old.map(i=>i.product.id===p.id?{...i,quantity:Math.min(10000,i.quantity+n)}:i):[...old,{product:p,quantity:n}]);setToast('Added to your order')};
 const finder=()=>navigate('home','finder');
 const count=cart.reduce((s,i)=>s+i.quantity,0);
 return <><a className="skip-content" href="#main-content">Skip to content</a><div className="topline"><span>PRECISION PARTS. DOWN-TO-EARTH PRICES.</span><a href="tel:+18454999269">Expert help <span>845-499-9269</span><ArrowUpRight size={12}/></a></div><header className="header"><Logo/><nav aria-label="Main navigation"><SiteLink href="/catalog" active={page==='catalog'} onNavigate={()=>browse()}>Shop all</SiteLink><SiteLink href="/#finder" onNavigate={finder}>Find my fastener<span className="nav-dot"/></SiteLink><SiteLink href="/types" active={page==='types'} onNavigate={()=>navigate('types')}>All types</SiteLink><SiteLink href="/tools" active={['tools','measuring','materials','guide','applications'].includes(page)} onNavigate={()=>navigate('tools')}>Tools</SiteLink><SiteLink href="/bulk-orders" active={page==='bulk-orders'} onNavigate={()=>navigate('bulk-orders')}>For business</SiteLink><SiteLink href="/contact" active={page==='contact'} onNavigate={()=>navigate('contact')}>Contact</SiteLink></nav><div className="header-actions"><button className="icon-btn desktop-only" aria-label="Search catalog" onClick={()=>browse()}><Search size={20}/></button><button className="bag-btn" aria-label={'Open order, '+count+' packs'} onClick={()=>setCartOpen(true)}><ShoppingBag size={20}/><span className="bag-label">Your order</span><span className="bag-count">{count}</span></button><button className="icon-btn mobile-only" onClick={()=>setMenu(true)} aria-label="Open menu"><Menu size={24}/></button></div></header>
 {menu&&<div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation"><button className="icon-btn close-menu" aria-label="Close menu" onClick={()=>setMenu(false)}><X/></button><Logo/>{[['catalog','Shop all fasteners'],['home','Find my fastener'],['types','All fastener types'],['tools','Tools & guides'],['bulk-orders','Bulk & business'],['about','Our story'],['contact','Contact']].map(([p,l])=><button key={p} onClick={()=>p==='catalog'?browse():p==='home'?finder():navigate(p)}>{l}<ArrowUpRight/></button>)}<a href="tel:+18454999269">845-499-9269</a></div>}
 <main className="store-main" id="main-content">{page==='home'&&<>
 <LiveHero onSearch={q=>browse('',q)} onOpen={open} onTypes={()=>navigate('types')} onBrowse={c=>browse(c||'')}/>

 <div className="trust-strip"><span><PackageCheck/>Precision specifications</span><span><Box/>Bulk quantities. Better value.</span><span><MessageCircle/>Real people. Expert support.</span><span><Truck/><span>Ships fast with<br/><strong>UPS · USPS · FedEx</strong></span></span></div>
 <div className="personality-line"><span>FOR THE MAKERS.</span><i>+</i><span>THE FIXERS.</span><i>+</i><span>THE “I CAN BUILD THAT” PEOPLE.</span><i>+</i><span>LET’S GET TO WORK.</span></div><TypeExplorer compact onBrowse={(g,t)=>browse('','',g,t)} onAll={()=>navigate('types')}/>
 <ToolsSpotlight onNavigate={navigate}/>
 <ProjectNavigator onBrowse={q=>browse('',q)} onOpen={open}/>
 <section className="section featured"><div className="section-heading"><div><p className="eyebrow">READY FOR YOUR NEXT BUILD</p><h2>Find your fit.</h2></div><button className="text-link" onClick={()=>browse()}>Explore the catalog <ArrowUpRight size={17}/></button></div><div className="home-product-grid">{homeProducts.map(p=><article className="home-product-card" key={p.id}><button className="home-product-image" onClick={()=>open(p)} aria-label={'View '+p.name}><span>{p.subcategory||p.category}</span><PanZoomPhoto src={p.image} alt={p.name} compact className="home-draggable-photo"/><ArrowUpRight size={18}/></button><p className="sku">DS / {p.sku}</p><button className="home-product-name" onClick={()=>open(p)}>{p.name}</button><p className="home-product-material">{[p.material,p.finish].filter(Boolean).join(' · ')}</p><div className="home-product-price"><span>{p.price!==null?<><b>{money(p.price)}</b><small> / {p.packQuantity?.toLocaleString()} pack</small></>:'Request a quote'}</span><AddToRequestButton productName={p.name} onAdd={()=>add(p)}/></div></article>)}</div></section>
 <section className="connection-banner"><div><p className="eyebrow">MORE THAN A PART NUMBER</p><h2>Real hardware.<br/>Human expertise.</h2></div><div><p>From a handful of fasteners to a serious production run, let’s get your order right. Build your list, share it with our team, and keep your project moving.</p><button className="btn btn-white" onClick={()=>navigate('contact')}>Let’s talk hardware <ArrowUpRight size={17}/></button></div></section>
 <section className="process section"><p className="eyebrow">THE WAY FORWARD</p><div className="process-grid">{[['Find your part.','Search by type, size, material, or part number. Compare the details that matter.'],['Make your connection.','Add the parts and quantities you need to one clear, organized order.'],['We’ll take it from here.','Share your order with our team. We confirm pricing, availability, and shipping.']].map(([t,p],i)=><div key={t}><span className="process-number">0{i+1}</span><h3>{t}</h3><p>{p}</p></div>)}</div></section>
 </>}
 {page==='catalog'&&<CatalogView key={category+'|'+query+'|'+group+'|'+type} initialCategory={category} initialQuery={query} initialGroup={group} initialType={type} onOpen={open} onAdd={add} onGuide={finder}/>}
 {page==='product'&&(productLoading?<div className="loading-state"><Loader2 className="spin"/> Finding your part…</div>:product?<ProductView key={product.id} product={product} onOpen={open} onAdd={add} onBrowse={browse} onOrder={()=>setCartOpen(true)} onGuide={finder}/>:<div className="empty-state"><h1>Part not found.</h1><p>{productError}</p><button className="btn btn-dark" onClick={()=>browse()}>Explore the catalog</button></div>)}
 {page==='tools'&&<ToolsHub onNavigate={navigate} onBrowse={()=>browse()} onFind={finder}/>}
 {page==='types'&&<TypeExplorer onBrowse={(g,t)=>browse('','',g,t)} onAll={()=>browse()}/>}
 {!['home','catalog','product','types','tools'].includes(page)&&<InfoPage page={page} onBrowse={()=>browse()} onNavigate={navigate}/>}
 </main><footer className="site-footer"><div className="footer-top"><div><Logo/><h2>Hold something<br/>great together.</h2></div><div className="footer-links"><div><p className="eyebrow">EXPLORE</p><button onClick={()=>browse()}>All fasteners</button><button onClick={()=>navigate('types')}>All fastener types</button><SiteLink href="/tools" onNavigate={()=>navigate('tools')}>Tools & guides</SiteLink><SiteLink href="/measuring" onNavigate={()=>navigate('measuring')}>Measure & convert</SiteLink><button onClick={()=>navigate('about')}>Our story</button></div><div><p className="eyebrow">HERE TO HELP</p><button onClick={()=>navigate('contact')}>Contact us</button><button onClick={()=>navigate('faq')}>Questions, answered</button><button onClick={()=>navigate('bulk-orders')}>Bulk & business orders</button><button onClick={()=>navigate('shipping')}>Shipping & ordering</button><button onClick={()=>navigate('returns')}>Returns & changes</button><a href="tel:+18454999269">845-499-9269</a></div><div><p className="eyebrow">FIND US</p><p>245 Quaker Road<br/>Pomona, NY, USA</p><span className="footer-shipping-label"><Truck size={16}/>Ships fast with</span><span className="footer-carriers">UPS <b>USPS</b> FedEx</span><p className="footer-shipping-note">Delivery timing confirmed with your order.</p></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Discount Screws.</span><span>PRECISION. WITHOUT COMPLICATION.</span><div><button onClick={()=>navigate('terms')}>Ordering terms</button><button onClick={()=>navigate('privacy')}>Privacy</button></div></div></footer>
 {cartOpen&&<OrderDrawer items={cart} onChange={setCart} onClose={()=>setCartOpen(false)} onBrowse={()=>{setCartOpen(false);browse()}}/>}
 {toast&&<div className="toast" role="status"><Check size={17}/>{toast}<button onClick={()=>setCartOpen(true)}>View order <ArrowRight size={14}/></button></div>}
 </>;
}
