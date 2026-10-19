import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({ root, configFile: path.join(root, 'pages.vite.config.ts') });
const out = path.join(root, '.pages-dist');
const html = await readFile(path.join(out, 'index.html'), 'utf8');
const products = JSON.parse(await readFile(path.join(root, 'lib/data/products.json'), 'utf8'));
const pages = { catalog: 'The Fastener Catalog', types: 'All Fastener Types', tools: 'Tools & Fastener Guides', about: 'Our Story', contact: 'Contact Discount Screws', faq: 'Questions, Answered', 'bulk-orders': 'Bulk & Business Orders', materials: 'Materials & Finishes', measuring: 'Fastener Measuring Center', guide: 'The Fastener Field Guide', shipping: 'Shipping & Ordering', returns: 'Returns & Order Changes', applications: 'Hardware for Your Next Build', privacy: 'Privacy', terms: 'Ordering Terms' };
const origin = 'https://selleryd.github.io/discount-screws/';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const routes = Object.entries(pages).map(([route, title]) => ({ route, title }));
for (const product of products) routes.push({ route: 'product/' + encodeURIComponent(product.id), title: product.name, product });
for (const { route, title, product } of routes) {
  const url = origin + route + '/';
  const description = product ? `${product.name}. Specifications and carton pricing for SKU ${product.sku}. Request a confirmed WhatsApp quote.` : `${title}. Explore precision fasteners with DiscountScrews.`;
  let page = html.replace(/<title>.*?<\/title>/, `<title>${escape(title)} | DiscountScrews</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, '$1' + escape(description))
    .replace(/(<meta property="og:title" content=")[^"]*/, '$1' + escape(title))
    .replace(/(<meta property="og:url" content=")[^"]*/, '$1' + escape(url))
    .replace(/(<link rel="canonical" href=")[^"]*/, '$1' + escape(url));
  if (product) {
    const image = product.image.startsWith('/') ? 'https://selleryd.github.io' + product.image : product.image;
    page = page.replace(/(<meta property="og:image" content=")[^"]*/, '$1' + escape(image));
    const schema = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, sku: product.sku, image, description, additionalProperty: Object.entries(product.specs).map(([name,value]) => ({ '@type': 'PropertyValue', name, value })) };
    page = page.replace('</head>', `<script type="application/ld+json">${json(schema)}</script></head>`);
  }
  const directory = path.join(out, route);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), page);
}
await writeFile(path.join(out, '404.html'), html.replace('</head>', '<meta name="robots" content="noindex" /></head>'));
await writeFile(path.join(out, '.nojekyll'), '');
await writeFile(path.join(out, 'README'), 'discountscrews');
await writeFile(path.join(out, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ['', ...routes.map(r => r.route + '/')].map(route => `<url><loc>${origin}${escape(route)}</loc></url>`).join('') + '</urlset>\n');
console.log(`GitHub Pages ready: ${routes.length + 1} routes, ${products.length} products. Output: ${out}`);
