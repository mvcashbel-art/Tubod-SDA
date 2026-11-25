/* "From the district": shows announcements posted by district officers on a church site's Home page.
   Public read only (no sign-in, no member data). Fails quietly if the district server is unreachable. */
(() => {
'use strict';
const API = 'https://script.google.com/macros/s/AKfycbz9WQMbKQpvTiLmwijqC-7K9d1IIZvd48fT2MgBw_dhONQcha80g137XQFyEvodHPhILA/exec';
const DISTRICT_URL = 'https://mvcashbel-art.github.io/isabel-merida-district/';
const CODES = { apale: 'I02', isabel: 'I03', simangan: 'I04', 'puting-bato': 'I05', bantigue: 'I06', 'san-francisco': 'I07' };
const KEY = 'district-ann-cache', TTL = 10 * 60 * 1000;
const path = location.pathname.toLowerCase();
let code = '';
if (path.indexOf('/tubod-sda') >= 0) code = 'TBD';
else { const m = /\/churches\/([a-z-]+)\//.exec(path); if (m && CODES[m[1]]) code = CODES[m[1]]; }
if (window.DISTRICT_CHURCH_CODE) code = window.DISTRICT_CHURCH_CODE;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let items = null;

const css = document.createElement('style');
css.textContent = '.dnews h3{margin:0 0 8px}.dnews .dn{padding:9px 0;border-top:1px solid var(--line,#D9E4EA)}.dnews .dn:first-of-type{border-top:0;padding-top:0}' +
  '.dnews .dn b{display:block;line-height:1.3}.dnews .dn small{color:var(--muted,#5B7083)}.dnews .dn p{margin:4px 0 0;white-space:pre-line;overflow-wrap:anywhere}' +
  '.dnews .pin{display:inline-block;font-size:.7rem;font-weight:700;padding:1px 7px;border-radius:99px;background:var(--gold-soft,#FBF1D9);color:#8a5a00;margin-right:6px;vertical-align:1px}' +
  '.dnews .more-l{display:inline-block;margin-top:8px;font-weight:600}';
document.head.appendChild(css);

function fmtDate(s) { const d = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); if (!d) return ''; return new Date(+d[1], +d[2] - 1, +d[3]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function mine() { return (items || []).filter(x => !x.church || x.church === code).slice(0, 3); }

function mount() {
  const side = $('#side'); if (!side || side.hidden || !items) return;
  const anchor = side.querySelector('#votd') || side.querySelector('#sabbathCard'); if (!anchor) return;
  const list = mine(), have = side.querySelector('#dnews');
  if (!list.length) { if (have) have.remove(); return; }
  const html = '<h3>From the district</h3>' + list.map(x =>
    '<div class="dn"><b>' + (x.pinned ? '<span class="pin">Pinned</span>' : '') + esc(x.title) + '</b><small>' + esc(fmtDate(x.date)) + (x.church ? ' · this church' : '') + '</small>' +
    (x.body ? '<p>' + esc(x.body) + '</p>' : '') + '</div>').join('') +
    '<a class="more-l" href="' + DISTRICT_URL + '#news" target="_blank" rel="noopener">All district news</a>';
  if (have) { if (have.dataset.h !== html) { have.innerHTML = html; have.dataset.h = html; } return; }
  const d = document.createElement('div'); d.className = 'card dnews'; d.id = 'dnews'; d.dataset.h = html; d.innerHTML = html;
  anchor.insertAdjacentElement('afterend', d);
}

async function load() {
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && Array.isArray(c.list)) { items = c.list; if (Date.now() - c.t < TTL) return; } } catch (e) {}
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'publicAnnouncements' }), redirect: 'follow' });
    const r = await res.json();
    if (r && r.ok && Array.isArray(r.announcements)) { items = r.announcements; try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), list: items })); } catch (e) {} }
  } catch (e) { /* offline or not deployed yet: show nothing */ }
}

let q = false;
function tick() { if (q) return; q = true; requestAnimationFrame(() => { q = false; mount(); }); }
function init() {
  load().then(mount);
  const side = $('#side'); if (!side) return;
  new MutationObserver(tick).observe(side, { childList: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
