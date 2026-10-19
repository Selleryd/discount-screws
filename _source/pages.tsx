import './app/globals.css';
import { createRoot } from 'react-dom/client';
import Storefront from './components/storefront';
import { appPath, sitePath } from './lib/pages-path';

const parts = appPath(window.location.pathname).split('/').filter(Boolean);
const knownPages = new Set(['home', 'catalog', 'product', 'types', 'tools', 'about', 'contact', 'faq', 'bulk-orders', 'materials', 'measuring', 'guide', 'shipping', 'returns', 'applications', 'privacy', 'terms']);
const page = parts[0] || 'home';
const productId = page === 'product' && parts[1] ? decodeURIComponent(parts[1]) : undefined;

const business = { '@context': 'https://schema.org', '@type': 'HardwareStore', name: 'Discount Screws', url: 'https://selleryd.github.io/discount-screws/', telephone: '+1-845-354-9100', address: { '@type': 'PostalAddress', streetAddress: '245 Quaker Road', addressLocality: 'Pomona', addressRegion: 'NY', addressCountry: 'US' } };
createRoot(document.getElementById('root')!).render(<>
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(business) }} />
  {knownPages.has(page) ? <Storefront initialPage={page} initialProductId={productId} /> : <main className="empty-state"><h1>Let’s find your way.</h1><p>This page isn’t in our catalog.</p><a className="btn btn-dark" href={sitePath('/catalog')}>Browse fasteners</a></main>}
</>);
