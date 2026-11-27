/* One-time "Add to Home screen" message on phones: Android gets an Install button, iPhone gets the steps, in-app browsers are told to open Chrome or Safari. */
(() => {
'use strict';
if (window.__installtip) return; window.__installtip = 1;
const KEY = 'installTip:' + location.pathname.replace(/[^/]*$/, '');
const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
const put = o => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(get(), o))); } catch (e) {} };
const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|Snapchat|TikTok/i.test(ua);
const phone = () => matchMedia('(max-width:900px)').matches && matchMedia('(pointer:coarse)').matches;
const ceb = () => document.documentElement.lang === 'ceb';
const TX = {
  en: { title: 'Install this app', a: 'Add it to your Home screen. It opens like an app, works with a weak signal, and shows you when there is something new.', install: 'Install', later: 'Not now', got: 'Got it',
    ios: 'Tap the Share button (the square with an arrow) at the bottom of Safari, then choose “Add to Home Screen”.', inapp: 'This page is open inside another app. Tap the ⋮ or … menu and choose “Open in browser” (Chrome or Safari), then install it from there.', menu: 'Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.' },
  ceb: { title: 'I-install kini nga app', a: 'Idugang sa imong Home screen. Mabuksan kini sama sa app, molihok bisan huyang ang signal, ug ipakita kung naay bag-o.', install: 'I-install', later: 'Dili pa', got: 'Sige',
    ios: 'I-tap ang Share button (ang kuwadrado nga naay udyon) sa ubos sa Safari, dayon pilia ang “Add to Home Screen”.', inapp: 'Kini nga panid nabuksan sulod sa lain nga app. I-tap ang ⋮ o … nga menu ug pilia ang “Open in browser” (Chrome o Safari), dayon i-install gikan didto.', menu: 'Ablihi ang menu sa imong browser (⋮) ug pilia ang “Install app” o “Add to Home screen”.' }
};
let deferred = null, bar = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
addEventListener('appinstalled', () => { put({ done: 1 }); if (bar) { bar.remove(); bar = null; } });
const st = document.createElement('style');
st.textContent = '.it{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));max-width:460px;margin:0 auto;z-index:78;background:#fff;color:#17324D;border:1px solid #D9E4EA;border-radius:18px;padding:14px;box-shadow:0 10px 30px rgba(5,12,30,.35);font:500 .9rem/1.4 system-ui,-apple-system,Segoe UI,sans-serif;animation:itin .3s ease-out}' +
  '.it .h{display:flex;align-items:center;gap:10px;margin-bottom:6px}.it img{width:40px;height:40px;border-radius:10px;flex:none;object-fit:cover}.it b{font-size:1.02rem}.it p{margin:0 0 10px}' +
  '.it .r{display:flex;gap:8px}.it button{border:0;border-radius:999px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer}.it .go{background:var(--accent,#1D6A8A);color:#fff;flex:1}.it .no{background:#EEF4F7;color:#17324D}' +
  '@keyframes itin{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion:reduce){.it{animation:none}}@media print{.it{display:none!important}}';
document.head.appendChild(st);
function show() {
  if (bar || document.querySelector('.ub') || document.querySelector('.modal,#auth')) return;
  const t = TX[ceb() ? 'ceb' : 'en'], icon = (document.querySelector('link[rel="apple-touch-icon"]') || document.querySelector('link[rel~="icon"]') || {}).href || '';
  const can = !!deferred && !inApp, body = inApp ? t.inapp : (can ? t.a : (ios ? t.ios : t.menu));
  bar = document.createElement('div'); bar.className = 'it'; bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-label', t.title); bar.setAttribute('data-notr', '');
  bar.innerHTML = '<div class="h">' + (icon ? '<img alt="" src="' + icon.replace(/"/g, '') + '">' : '') + '<b></b></div><p></p><div class="r"><button type="button" class="go"></button><button type="button" class="no"></button></div>';
  bar.querySelector('b').textContent = t.title; bar.querySelector('p').textContent = body;
  const go = bar.querySelector('.go'), no = bar.querySelector('.no'); go.textContent = can ? t.install : t.got; no.textContent = t.later;
  const close = days => { put({ t: Date.now(), snooze: days }); bar.remove(); bar = null; };
  go.addEventListener('click', async () => {
    if (can) { try { deferred.prompt(); const c = await deferred.userChoice; deferred = null; if (c && c.outcome === 'accepted') { put({ done: 1 }); bar.remove(); bar = null; return; } } catch (e) {} close(21); }
    else close(60);
  });
  no.addEventListener('click', () => close(21));
  document.body.appendChild(bar);
}
function start() {
  const s = get(); if (s.done || standalone() || !phone()) return;
  if (s.t && Date.now() - s.t < (s.snooze || 21) * 864e5) return;
  const n = (s.n || 0) + 1; put({ n });
  setTimeout(show, n >= 2 ? 8000 : 45000);
}
if (document.readyState === 'complete') start(); else addEventListener('load', start);
})();
