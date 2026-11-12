/* Tubod SDA Church: keeps the site working with weak or no signal.
   Put this file next to index.html on GitHub. The site registers it by itself. */
/* OneSignal push (only does anything once an App ID is set in config.js and you have subscribed). Guarded so the site still works offline if it cannot load. */
try { self.importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch (e) { /* offline or not configured: the site still works */ }
const VERSION = 'tubod-v2';
const CORE = ['./', './index.html', './config.js', './manifest.json', './logo-mark.png', './icon-192.png', './icon-512.png', './bible-game.html'];
const PICS = 'tubod-pics-v1';
const MAX_PICS = 250;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== PICS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* the page and config: try the internet first (so updates show at once), use the saved copy when offline */
function networkFirst(req){
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('./index.html'));
    const timer = setTimeout(() => { if (!done) fallback().then(r => { if (r && !done){ done = true; resolve(r); } }); }, 6000);
    fetch(req).then(res => {
      if (res && res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      if (!done){ done = true; clearTimeout(timer); resolve(res); }
    }).catch(() => fallback().then(r => { if (!done){ done = true; clearTimeout(timer); resolve(r || Response.error()); } }));
  });
}

/* logos, icons and fonts: use the saved copy, refresh it in the background */
function staleWhileRevalidate(req, cacheName){
  return caches.open(cacheName).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
}

/* photo thumbnails from Google Drive: keep the most recent ones for offline viewing */
function picture(req){
  return caches.open(PICS).then(c => c.match(req).then(hit => {
    if (hit) return hit;
    return fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')){
        c.put(req, res.clone()).then(() => c.keys()).then(keys => { if (keys.length > MAX_PICS) keys.slice(0, keys.length - MAX_PICS).forEach(k => c.delete(k)); });
      }
      return res;
    });
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // never touch the church server or uploads to Google Drive
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('script.googleusercontent.com') || url.hostname === 'www.googleapis.com') return;
  if (url.origin === self.location.origin){
    if (req.mode === 'navigate' || /\.(html|js|json)$/.test(url.pathname) || url.pathname.endsWith('/')) { e.respondWith(networkFirst(req)); return; }
    e.respondWith(staleWhileRevalidate(req, VERSION)); return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){ e.respondWith(staleWhileRevalidate(req, VERSION)); return; }
  // small Drive pictures only (=w400 and the like); full-size originals are too big to keep on a phone
  if (url.hostname === 'lh3.googleusercontent.com' && /=w\d{2,4}$/.test(url.pathname + url.search)){ e.respondWith(picture(req)); return; }
});

/* tapping a church notification opens the church page */
self.addEventListener('notificationclick', e => {
  if (e.notification && e.notification.tag && e.notification.tag !== 'tubod-ann') return; // let OneSignal handle its own notifications
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const open = list.find(c => c.url.indexOf(self.registration.scope) === 0);
    if (open) { open.focus(); if (open.navigate) open.navigate('./#news').catch(() => {}); return; }
    return self.clients.openWindow('./#news');
  }));
});
