/* Desktop-friendly share box. Phones use the built-in share sheet; computers get this: Share on Facebook, Copy, and a preview of the message.
   Use:  window.__shareBox(title, text, url) */
(() => {
'use strict';
if (window.__shareBox) return;
const ceb = () => document.documentElement.lang === 'ceb';
const TX = {
  en: { h: 'Share', fb: 'Share on Facebook', cp: 'Copy message', cd: 'Copied', cl: 'Close', note: 'On Facebook, the link is shared and your message is copied, so you can paste it into your post.' },
  ceb: { h: 'Ipaambit', fb: 'Ipaambit sa Facebook', cp: 'I-copy ang mensahe', cd: 'Na-copy na', cl: 'Close', note: 'Sa Facebook, ang link ang ipaambit ug na-copy ang imong mensahe, i-paste lang sa imong post.' }
};
const T = k => (ceb() ? TX.ceb : TX.en)[k];
let dlg, ta, fb, cp, hd, nt, cl, cur = null;
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) { try { ta.focus(); ta.select(); return document.execCommand('copy'); } catch (er) { return false; } }
}
function build() {
  const st = document.createElement('style');
  st.textContent = '.sbx{max-width:min(460px,94vw);width:100%;border:1px solid var(--line,#d6e4f8);border-radius:18px;background:var(--surface,#fff);color:var(--ink,#10233f);padding:18px;box-shadow:0 20px 60px rgba(5,12,30,.35)}' +
    '.sbx::backdrop{background:rgba(5,12,30,.55)}.sbx h3{margin:0 0 10px;font-size:1.15rem}' +
    '.sbx textarea{width:100%;box-sizing:border-box;min-height:120px;resize:vertical;border:1px solid var(--line,#d6e4f8);border-radius:12px;padding:10px;font:inherit;font-size:.92rem;background:var(--bg,#f6f9fd);color:inherit}' +
    '.sbx small{display:block;margin:8px 0 12px;color:var(--muted,#5b6b82);line-height:1.4}.sbx .r{display:flex;gap:10px;flex-wrap:wrap}' +
    '.sbx button{font:inherit;font-weight:600;border-radius:999px;padding:10px 16px;cursor:pointer;border:1px solid var(--line,#d6e4f8);background:var(--surface,#fff);color:var(--ink,#10233f)}' +
    '.sbx button.p{background:#1877f2;border-color:#1877f2;color:#fff}.sbx button:focus-visible{outline:3px solid #e3a72b;outline-offset:2px}@media print{.sbx{display:none}}';
  document.head.appendChild(st);
  dlg = document.createElement('dialog'); dlg.className = 'sbx'; dlg.setAttribute('data-notr', ''); dlg.setAttribute('aria-labelledby', 'sbxH');
  dlg.innerHTML = '<h3 id="sbxH"></h3><textarea readonly aria-label="Message"></textarea><small></small><div class="r"><button type="button" class="p" data-a="fb"></button><button type="button" data-a="cp"></button><button type="button" data-a="cl"></button></div>';
  document.body.appendChild(dlg);
  hd = dlg.querySelector('h3'); ta = dlg.querySelector('textarea'); nt = dlg.querySelector('small');
  fb = dlg.querySelector('[data-a=fb]'); cp = dlg.querySelector('[data-a=cp]'); cl = dlg.querySelector('[data-a=cl]');
  cl.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  cp.addEventListener('click', async () => { if (await copy(ta.value)) { const o = T('cp'); cp.textContent = T('cd'); setTimeout(() => { cp.textContent = o; }, 2200); } });
  fb.addEventListener('click', async () => {
    if (!cur) return; await copy(ta.value);
    const u = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(cur.url) + '&quote=' + encodeURIComponent((cur.title || '').slice(0, 200));
    window.open(u, '_blank', 'noopener,noreferrer');
  });
}
window.__shareBox = (title, text, url) => {
  if (!dlg) build();
  cur = { title, text, url };
  hd.textContent = T('h'); fb.textContent = T('fb'); cp.textContent = T('cp'); cl.textContent = T('cl'); nt.textContent = T('note');
  ta.value = (text || title || '') + (url ? '\n' + url : '');
  try { if (!dlg.open) dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
  cp.focus({ preventScroll: true });
};
})();
