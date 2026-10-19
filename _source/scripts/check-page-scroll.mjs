import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../components/page-scroll.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

// Exercise real hook logic with controlled commits and DOM events. No browser or timers.
function setup(hash = '') {
  let state, cursor = 0, pending = [], mounted = false;
  const effects = [], events = new Map(), calls = [], style = new Map();
  const inline = {
    getPropertyValue: key => style.get(key)?.value || '',
    getPropertyPriority: key => style.get(key)?.priority || '',
    setProperty: (key, value, priority = '') => style.set(key, {value, priority}),
    removeProperty: key => style.delete(key),
  };
  const anchor = { scrollIntoView(options) { calls.push({kind:'anchor', options, behavior:inline.getPropertyValue('scroll-behavior')}); } };
  const win = {
    history: { scrollRestoration: 'auto' },
    location: { hash, pathname: '/catalog', search: '' },
    scrollTo(options) { calls.push({kind:'top', options, behavior:inline.getPropertyValue('scroll-behavior')}); },
    addEventListener: (name, listener) => events.set(name, listener),
    removeEventListener: name => events.delete(name),
  };
  const react = {
    useState(initial) { if (!mounted) state = initial; return [state, updater => { state = updater(state); }]; },
    useCallback: callback => callback,
    useLayoutEffect(fn, dependencies) {
      const index = cursor++, prior = effects[index];
      if (!prior || dependencies.some((value, i) => !Object.is(value, prior.dependencies[i]))) {
        pending.push(() => { prior?.cleanup?.(); effects[index] = { dependencies, cleanup: fn() }; });
      }
    },
  };
  const exports = {};
  runInNewContext(compiled, { exports, require: name => { assert.equal(name, 'react'); return react; }, window:win, document:{ documentElement:{style:inline}, getElementById:id => id === 'finder' ? anchor : null } });
  const render = () => { cursor = 0; const request = exports.usePageScroll(); mounted = true; return request; };
  const commit = () => { const callbacks = pending; pending = []; callbacks.forEach(fn => fn()); };
  return {exports,win,inline,calls,events,render,commit,unmount:() => effects.forEach(effect => effect.cleanup?.())};
}

const h = setup();
h.inline.setProperty('scroll-behavior','smooth','important');
const request = h.render();
assert.equal(h.calls.length, 0, 'must wait for the page DOM commit');
h.commit();
assert.equal(h.win.history.scrollRestoration,'manual');
assert.equal(h.calls[0].kind,'top');
assert.equal(h.calls[0].behavior,'auto', 'route reset cannot animate under global smooth CSS');
assert.equal(h.calls[0].options.top,0);
assert.equal(h.inline.getPropertyValue('scroll-behavior'),'smooth');
assert.equal(h.inline.getPropertyPriority('scroll-behavior'),'important');

h.win.location.pathname='/product/123';
request();
assert.equal(h.calls.length,1, 'navigation event must not scroll the old catalog DOM');
h.render();h.commit();
assert.equal(h.calls.length,2);
h.render();h.commit();
assert.equal(h.calls.length,2, 'late 3D/photos/product data and cart rerenders must not reset user scrolling');
request();h.render();h.commit();
assert.equal(h.calls.length,3, 'a repeated same-product navigation still starts at top');
h.win.location.pathname='/product/456';request();h.render();h.commit();
assert.equal(h.calls.length,4, 'related product navigation starts at top');

h.win.location.pathname='/';request('finder');h.render();h.commit();
assert.equal(h.calls.at(-1).kind,'anchor','finder destination is honored after its page commits');
h.exports.scrollToPageStart('missing');
assert.equal(h.calls.at(-1).kind,'top','unknown anchors have a safe page-top fallback');
h.events.get('pageshow')({persisted:true});
assert.equal(h.calls.at(-1).kind,'top','bfcache restores start at top');
h.unmount();
assert.equal(h.events.size,0);
assert.equal(h.win.history.scrollRestoration,'auto');

const deepLink=setup('#finder');deepLink.render();deepLink.commit();
assert.equal(deepLink.calls[0].kind,'anchor','explicit incoming anchor links remain usable');
assert.equal(deepLink.inline.getPropertyValue('scroll-behavior'),'','no inline style is leaked');
deepLink.win.location.hash='#%E0%A4%A';
assert.equal(deepLink.exports.readPageAnchor(),null,'malformed URL fragments cannot abort navigation');
console.log('Page scroll regression checks passed: commit timing, instant reset, same/related product, late content, anchors, bfcache, cleanup.');
