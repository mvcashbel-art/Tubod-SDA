/* Floating "back to top" button for long pages. Shows after you scroll down; sits above the bottom menu bar on phones. */
(() => {
'use strict';
if (window.__totop) return; window.__totop = true;
const st = document.createElement('style');
st.textContent = '.totop{position:fixed;right:14px;bottom:16px;width:48px;height:48px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;z-index:40;' +
  'background:var(--accent,var(--blue,#1d5fd8));color:#fff;box-shadow:0 6px 18px rgba(10,30,60,.35);opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .2s,transform .2s,bottom .15s}' +
  '.totop.on{opacity:1;transform:none;pointer-events:auto}.totop:focus-visible{outline:3px solid #e3a72b;outline-offset:3px}.totop svg{width:24px;height:24px}' +
  '@media (prefers-reduced-motion:reduce){.totop{transition:none}}@media print{.totop{display:none!important}}';
document.head.appendChild(st);
const b = document.createElement('button'); b.type = 'button'; b.className = 'totop'; b.setAttribute('data-notr', '');
b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const label = () => document.documentElement.lang === 'ceb' ? 'Balik sa ibabaw (menu)' : 'Back to top (menu)';
function place() {
  b.setAttribute('aria-label', label()); b.title = label();
  let extra = 0; const tabs = document.querySelector('#tabs');
  if (tabs) { const cs = getComputedStyle(tabs); if (cs.display !== 'none' && cs.position === 'fixed') extra = tabs.offsetHeight; }
  b.style.bottom = (extra + 16) + 'px';
  b.classList.toggle('on', (window.scrollY || document.documentElement.scrollTop) > 480);
}
let pend = false;
const tick = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; place(); }); };
addEventListener('scroll', tick, { passive: true }); addEventListener('resize', tick);
b.addEventListener('click', () => {
  const calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
  window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
  const f = document.querySelector('header a, header button, nav a'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
});
document.body.appendChild(b); place();
setInterval(place, 2000); /* catches language or layout changes that do not scroll */
})();
