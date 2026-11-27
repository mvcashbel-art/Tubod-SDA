/* "New version" bar: when the site has been updated, one tap loads it. Works on the district site and every church site. */
(() => {
'use strict';
if (window.__updatebar) return; window.__updatebar = 1;
const sw = navigator.serviceWorker;
const hadCtl = !!(sw && sw.controller);
let base = null, shown = false, dismissed = '', last = 0, bar = null, cur = '';
const ceb = () => document.documentElement.lang === 'ceb';
const T = () => ceb() ? { msg: 'Bag-ong bersyon andam na', btn: 'I-refresh', x: 'Isalikway' } : { msg: 'A new version is ready', btn: 'Refresh', x: 'Dismiss' };
const st = document.createElement('style');
st.textContent = '.ub{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(380px,calc(100vw - 32px));z-index:80;display:flex;align-items:center;gap:10px;background:#10233f;color:#fff;border-radius:14px;padding:9px 10px 9px 14px;box-shadow:0 8px 24px rgba(5,12,30,.4);font:600 .88rem/1.2 system-ui,-apple-system,Segoe UI,sans-serif;animation:ubin .3s ease-out}' +
  '.ub[hidden]{display:none}.ub span{flex:1;min-width:0}.ub button{border:0;cursor:pointer;font:inherit}' +
  '.ub .go{background:#e3a72b;color:#2a1d00;border-radius:999px;padding:8px 14px;font-weight:700}.ub .no{background:none;color:#fff;opacity:.7;font-size:1.2rem;line-height:1;padding:4px 6px}' +
  '@media (max-width:900px){.ub{right:78px;left:12px;width:auto}}@keyframes ubin{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion:reduce){.ub{animation:none}}@media print{.ub{display:none!important}}';
document.head.appendChild(st);
function show(id) {
  if (dismissed && dismissed === id) return;
  if (!bar) {
    bar = document.createElement('div'); bar.className = 'ub'; bar.setAttribute('role', 'status'); bar.setAttribute('data-notr', '');
    bar.innerHTML = '<span></span><button type="button" class="go"></button><button type="button" class="no" aria-label="">×</button>';
    document.body.appendChild(bar);
    bar.querySelector('.go').addEventListener('click', async () => {
      try { const r = sw && await sw.getRegistration(); if (r) await r.update(); } catch (e) {}
      location.reload();
    });
    bar.querySelector('.no').addEventListener('click', () => { dismissed = cur; bar.hidden = true; shown = false; });
  }
  cur = id; const t = T();
  bar.querySelector('span').textContent = t.msg; bar.querySelector('.go').textContent = t.btn; bar.querySelector('.no').setAttribute('aria-label', t.x);
  bar.hidden = false; shown = true;
}
async function sig() {
  try {
    const r = await fetch(location.pathname, { cache: 'no-cache' });
    if (!r.ok) return null;
    const s = (r.headers.get('etag') || '') + '|' + (r.headers.get('last-modified') || '');
    return s === '|' ? null : s;
  } catch (e) { return null; }
}
async function check(force) {
  if (document.hidden || Date.now() - last < (force ? 15e3 : 60e3)) return; last = Date.now();
  try { const r = sw && await sw.getRegistration(); if (r) r.update().catch(() => {}); } catch (e) {}
  const s = await sig(); if (!s) return;
  if (base === null) { base = s; return; }
  if (s !== base) show(s);
}
if (sw) sw.addEventListener('controllerchange', () => { if (hadCtl) show('sw' + Date.now()); });
addEventListener('load', () => setTimeout(() => check(true), 4000));
document.addEventListener('visibilitychange', () => { if (!document.hidden) check(false); });
setInterval(() => check(false), 5 * 60e3);
})();
