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
/* Bisaya for this card's own words. The church's text layer is told to leave the card alone (data-notr). */
const BIS = { 'From the district': 'Gikan sa Distrito', 'District events': 'Mga Panghitabo sa Distrito', 'Add to my calendar': 'Idugang sa akong kalendaryo', 'Share': 'Ipaambit',
  'All district news': 'Tanang balita sa distrito', 'All district events': 'Tanang panghitabo sa distrito', 'Pinned': 'Gi-pin', 'this church': 'kining simbahan',
  'Copied. Paste in Messenger or Facebook.': 'Nakopya. I-paste sa Messenger o Facebook.' };
const L = k => (document.documentElement.lang === 'ceb' && BIS[k]) || k;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let items = null, events = [];

const css = document.createElement('style');
css.textContent = '.dnews h3{margin:0 0 8px}.dnews .dn{padding:9px 0;border-top:1px solid var(--line,#D9E4EA)}.dnews .dn:first-of-type{border-top:0;padding-top:0}' +
  '.dnews .dn b{display:block;line-height:1.3}.dnews .dn small{color:var(--muted,#5B7083)}.dnews .dn p{margin:4px 0 0;white-space:pre-line;overflow-wrap:anywhere}' +
  '.dnews .pin{display:inline-block;font-size:.7rem;font-weight:700;padding:1px 7px;border-radius:99px;background:var(--gold-soft,#FBF1D9);color:#8a5a00;margin-right:6px;vertical-align:1px}' +
  '.dnews .more-l{display:inline-block;margin-top:8px;font-weight:600}' +
  '.dnews .dn .bt{display:inline-block;margin:6px 6px 0 0;padding:3px 11px;border:1px solid var(--line,#D9E4EA);background:transparent;color:var(--accent,#1D6A8A);border-radius:99px;font:600 .8rem/1.4 inherit;cursor:pointer}';
document.head.appendChild(css);

function fmtDate(s) { const d = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); if (!d) return ''; return new Date(+d[1], +d[2] - 1, +d[3]).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function mine() { return (items || []).filter(x => !x.church || x.church === code).slice(0, 3); }
function mineEv() { const t = new Date(); const td = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
  return (events || []).filter(x => (!x.church || x.church === code) && x.date >= td).slice(0, 3); }
function evLine(e) { return [fmtDate(e.date), e.time, e.place].filter(Boolean).join(' · '); }
function icsFor(e) {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(e.date || ''); if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]), p = n => String(n).padStart(2, '0'), f = x => x.getFullYear() + p(x.getMonth() + 1) + p(x.getDate());
  const tm = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(e.time || ''), q = t => String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  let when;
  if (tm) { const h = +tm[1] % 12 + (/pm/i.test(tm[3]) ? 12 : 0), mi = +(tm[2] || 0), end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h + 2, mi);
    when = 'DTSTART;TZID=Asia/Manila:' + f(d) + 'T' + p(h) + p(mi) + '00\r\nDTEND;TZID=Asia/Manila:' + f(end) + 'T' + p(end.getHours()) + p(end.getMinutes()) + '00'; }
  else { const nx = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); when = 'DTSTART;VALUE=DATE:' + f(d) + '\r\nDTEND;VALUE=DATE:' + f(nx); }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Isabel-Merida District//EN', 'BEGIN:VEVENT', 'UID:' + e.id + '@isabel-merida-district', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]|\.\d{3}/g, ''),
    when, 'SUMMARY:' + q(e.title), 'LOCATION:' + q(e.place), 'DESCRIPTION:' + q(e.description), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

function mount() {
  const side = $('#side'); if (!side || side.hidden || !items) return;
  const anchor = side.querySelector('#votd') || side.querySelector('#sabbathCard'); if (!anchor) return;
  const list = mine(), evl = mineEv();
  put(side, anchor, 'dnews', list.length ? '<h3>' + L('From the district') + '</h3>' + list.map((x, i) =>
    '<div class="dn"><b>' + (x.pinned ? '<span class="pin">' + L('Pinned') + '</span>' : '') + esc(x.title) + '</b><small>' + esc(fmtDate(x.date)) + (x.church ? ' · ' + L('this church') : '') + '</small>' +
    (x.body ? '<p>' + esc(x.body) + '</p>' : '') + '<button type="button" class="bt" data-dshare="n' + i + '">' + L('Share') + '</button></div>').join('') +
    '<a class="more-l" href="' + DISTRICT_URL + '#news" target="_blank" rel="noopener">' + L('All district news') + '</a>' : '');
  const first = side.querySelector('#dnews') || anchor;
  put(side, first, 'devents', evl.length ? '<h3>' + L('District events') + '</h3>' + evl.map((e, i) =>
    '<div class="dn"><b>' + esc(e.title) + '</b><small>' + esc(evLine(e)) + (e.church ? ' · ' + L('this church') : '') + '</small>' + (e.description ? '<p>' + esc(e.description) + '</p>' : '') +
    '<button type="button" class="bt" data-dcal="' + i + '">' + L('Add to my calendar') + '</button><button type="button" class="bt" data-dshare="e' + i + '">' + L('Share') + '</button></div>').join('') +
    '<a class="more-l" href="' + DISTRICT_URL + '#events" target="_blank" rel="noopener">' + L('All district events') + '</a>' : '');
}
function put(side, anchor, id, html) {
  const have = side.querySelector('#' + id);
  if (!html) { if (have) have.remove(); return; }
  if (have) { if (have.dataset.h !== html) { have.innerHTML = html; have.dataset.h = html; } return; }
  const d = document.createElement('div'); d.className = 'card dnews'; d.id = id; d.setAttribute('data-notr', ''); d.dataset.h = html; d.innerHTML = html;
  anchor.insertAdjacentElement('afterend', d);
}
document.addEventListener('click', async ev => {
  const c = ev.target.closest('[data-dcal]'), sh = ev.target.closest('[data-dshare]');
  if (c) { const e = mineEv()[+c.dataset.dcal]; if (!e) return; const ics = icsFor(e); if (!ics) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = (e.title || 'event').replace(/[^\w]+/g, '-').slice(0, 40) + '.ics'; document.body.appendChild(a); a.click(); a.remove(); }
  if (sh) {
    const k = sh.dataset.dshare, i = +k.slice(1), it = k[0] === 'n' ? mine()[i] : mineEv()[i]; if (!it) return;
    const text = it.title + '\n' + (k[0] === 'n' ? (it.body || '') : evLine(it) + (it.description ? '\n' + it.description : ''));
    const url = DISTRICT_URL + (k[0] === 'n' ? (it.id ? '#a-' + it.id : '#news') : '#events');
    if (navigator.share) { try { await navigator.share({ title: it.title, text, url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text + '\n' + url); } catch (er) {}
    const old = sh.textContent; sh.textContent = L('Copied. Paste in Messenger or Facebook.'); setTimeout(() => { sh.textContent = old; }, 2600);
  }
});

async function load() {
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && Array.isArray(c.list)) { items = c.list; events = Array.isArray(c.events) ? c.events : []; if (Date.now() - c.t < TTL && Array.isArray(c.events)) return; } } catch (e) {}
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'publicAnnouncements' }), redirect: 'follow' });
    const r = await res.json();
    if (r && r.ok && Array.isArray(r.announcements)) { items = r.announcements; events = Array.isArray(r.events) ? r.events : []; try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), list: items, events: events })); } catch (e) {} }
  } catch (e) { /* offline or not deployed yet: show nothing */ }
}

let q = false;
function tick() { if (q) return; q = true; setTimeout(() => { q = false; mount(); }, 60); }
function init() {
  load().then(mount);
  const side = $('#side'); if (!side) return;
  new MutationObserver(tick).observe(side, { childList: true });
  new MutationObserver(tick).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
