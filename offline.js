/* "Use offline": one tap saves the app, the whole Bible, the latest church data and recent photos on this phone, so it opens with no internet. */
(() => {
'use strict';
if (window.__offline) return;
const BASE = 'https://mvcashbel-art.github.io/isabel-merida-district/bible/';
const KEY = 'offlineSaved:' + location.pathname.replace(/[^/]*$/, '');
const ceb = () => document.documentElement.lang === 'ceb';
const TX = {
  en: { title: 'Use offline', intro: 'Save this app on your phone so it opens even with no internet. Best done on Wi-Fi. It needs about 10 MB, and more with photos.', app: 'The app and all its pages', bible: 'The whole Bible (English and Cebuano)', data: 'Posts, announcements, members and events as they are now', pics: 'Recent photos', drive: 'Documents and videos kept on Google Drive still need internet.',
    last: d => 'Last saved: ' + d, never: 'Not saved yet.', go: 'Download now', again: 'Update now', close: 'Close', working: 'Saving…', offline: 'You are offline. Connect to the internet first, then try again.', done: 'All saved. You can open this app without internet.', part: 'Saved, but some parts could not be saved. Try again on a better connection.', stepApp: 'Saving the app…', stepBible: 'Saving the Bible…', stepData: 'Saving posts and members…', stepPics: 'Saving photos…' },
  ceb: { title: 'Gamita nga walay internet', intro: 'I-save kini nga app sa imong telepono aron mabuksan bisan walay internet. Maayo nga buhaton kung naay Wi-Fi. Mga 10 MB ang kinahanglan, labaw pa kung naay mga litrato.', app: 'Ang app ug tanan niyang panid', bible: 'Ang tibuok Biblia (English ug Cebuano)', data: 'Mga post, pahibalo, miyembro ug panghitabo sa karon', pics: 'Bag-ong mga litrato', drive: 'Ang mga dokumento ug video sa Google Drive nanginahanglan gihapon og internet.',
    last: d => 'Ulahing na-save: ' + d, never: 'Wala pa na-save.', go: 'I-download karon', again: 'I-update karon', close: 'Isira', working: 'Gi-save…', offline: 'Wala ka sa internet. Pag-konek una, dayon sulayi pag-usab.', done: 'Na-save na tanan. Mabuksan nimo kini nga app bisan walay internet.', part: 'Na-save na, apan adunay bahin nga wala ma-save. Sulayi pag-usab kung mas lig-on ang koneksyon.', stepApp: 'Gi-save ang app…', stepBible: 'Gi-save ang Biblia…', stepData: 'Gi-save ang mga post ug miyembro…', stepPics: 'Gi-save ang mga litrato…' }
};
const T = () => TX[ceb() ? 'ceb' : 'en'];
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const st = document.createElement('style');
st.textContent = '.of{position:fixed;inset:0;z-index:85;background:rgba(5,12,30,.6);display:flex;align-items:flex-end;justify-content:center;font:500 .92rem/1.45 system-ui,-apple-system,Segoe UI,sans-serif}' +
  '.of .sh{background:#fff;color:#17324D;width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));max-height:92dvh;overflow:auto}' +
  '.of h3{margin:0 0 6px;font-size:1.25rem}.of p{margin:0 0 10px}.of ul{margin:0 0 10px;padding:0;list-style:none}.of li{padding:3px 0 3px 26px;position:relative}.of li::before{content:"\\2713";position:absolute;left:4px;color:var(--accent,#1D6A8A);font-weight:800}' +
  '.of .mu{color:#5B7083;font-size:.86rem}.of .pr{height:10px;border-radius:99px;background:#D9E4EA;overflow:hidden;margin:10px 0 6px}.of .pr i{display:block;height:100%;width:0;background:var(--accent,#1D6A8A);transition:width .2s}' +
  '.of .r{display:flex;gap:8px;margin-top:12px}.of button{border:0;border-radius:12px;padding:12px 16px;font:inherit;font-weight:700;cursor:pointer}.of .go{background:var(--accent,#1D6A8A);color:#fff;flex:1}.of .go:disabled{opacity:.5}.of .no{background:#EEF4F7;color:#17324D}@media print{.of{display:none!important}}';
document.head.appendChild(st);
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const fmt = t => { try { return new Date(t).toLocaleString(ceb() ? 'ceb' : 'en-PH', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return new Date(t).toLocaleString(); } };
async function coreList() {
  try { const t = await (await fetch('sw.js', { cache: 'no-cache' })).text(), m = /const CORE = \[([\s\S]*?)\]/.exec(t); return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).filter(u => u !== './') : []; } catch (e) { return []; }
}
async function run(setP) {
  const app = window.__offlineApp || null; let ok = true, done = 0, total = 1; const tick = (label) => { done++; setP(Math.min(100, Math.round(done / total * 100)), label); };
  const pool = async (items, n, fn, label) => { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = items[i++]; try { await fn(k); } catch (e) { ok = false; } tick(label); } })); };
  setP(2, T().stepApp);
  const core = await coreList(), idx = await fetch(BASE + 'index.json').then(r => r.json()).catch(() => null), trs = idx && idx.translations ? idx.translations.map(t => t.id) : [];
  const bfiles = []; trs.forEach(id => { for (let n = 1; n <= 66; n++) bfiles.push(BASE + id + '/' + n + '.json'); });
  total = core.length + bfiles.length + (app && app.sync ? 1 : 0) + 40;
  await pool(core, 4, async u => { const r = await fetch(new URL(u, location.href).href, { cache: 'reload' }); if (!r.ok) throw 0; }, T().stepApp);
  const c = await caches.open('bible-v1').catch(() => null);
  if (c && bfiles.length) {
    await pool(bfiles, 4, async u => { if (await c.match(u)) return; const r = await fetch(u); if (!r.ok) throw 0; await c.put(u, r); }, T().stepBible);
    trs.forEach(id => { try { localStorage.setItem('bibleOff:' + id, '1'); } catch (e) {} });
  } else if (!c) ok = false;
  if (app && app.sync) { try { await app.sync(); } catch (e) { ok = false; } tick(T().stepData); }
  let pics = []; try { pics = app && app.pics ? app.pics() : []; } catch (e) {}
  total = done + pics.length;
  await pool(pics, 4, async u => { await fetch(u, { mode: 'no-cors' }); }, T().stepPics);
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  const rec = { t: Date.now(), ok, pics: pics.length }; try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) {}
  return rec;
}
function open() {
  if (document.querySelector('.of')) return;
  const t = T(), app = window.__offlineApp || null, s = saved(), o = document.createElement('div'); o.className = 'of'; o.setAttribute('data-notr', '');
  o.innerHTML = '<div class="sh" role="dialog" aria-modal="true" aria-label="' + esc(t.title) + '"><h3>' + esc(t.title) + '</h3><p>' + esc(t.intro) + '</p><ul><li>' + esc(t.app) + '</li><li>' + esc(t.bible) + '</li>' + (app && app.sync ? '<li>' + esc(t.data) + '</li>' : '') + (app && app.pics ? '<li>' + esc(t.pics) + '</li>' : '') + '</ul><p class="mu">' + esc(t.drive) + '</p><p class="mu" id="ofLast">' + esc(s ? t.last(fmt(s.t)) : t.never) + '</p><div class="pr" hidden><i></i></div><p class="mu" id="ofMsg" role="status"></p><div class="r"><button type="button" class="go">' + esc(s ? t.again : t.go) + '</button><button type="button" class="no">' + esc(t.close) + '</button></div></div>';
  const close = () => o.remove(), go = o.querySelector('.go'), msg = o.querySelector('#ofMsg'), pr = o.querySelector('.pr'), bar = pr.firstElementChild;
  o.addEventListener('click', e => { if (e.target === o) close(); }); o.querySelector('.no').addEventListener('click', close);
  go.addEventListener('click', async () => {
    if (navigator.onLine === false) { msg.textContent = t.offline; return; }
    go.disabled = true; pr.hidden = false; msg.textContent = t.working;
    try { const rec = await run((p, label) => { bar.style.width = p + '%'; msg.textContent = label || t.working; }); bar.style.width = '100%'; msg.textContent = rec.ok ? t.done : t.part; o.querySelector('#ofLast').textContent = t.last(fmt(rec.t)); go.textContent = t.again; }
    catch (e) { msg.textContent = t.part; }
    go.disabled = false;
  });
  document.body.appendChild(o);
}
document.addEventListener('click', e => { if (e.target.closest('[data-offline]')) { e.preventDefault(); open(); } });
window.__offline = { open };
})();
