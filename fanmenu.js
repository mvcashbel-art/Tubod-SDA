/* Phone menu: one round button on the right edge opens a half circle with every section. Tap again to close. */
(() => {
'use strict';
const church = !document.querySelector('nav.links');             /* church sites keep their menu in #dnav */
const nav = document.querySelector('nav.links') || document.querySelector('#dnav'); if (!nav) return;
const BP = church ? 900 : 859;
const ICONS = {
  churches: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6M12 5V2',
  news: 'M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 004 0',
  events: 'M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 10h16M8 3v4M16 3v4',
  gallery: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  ministries: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20v-1a5 5 0 0110 0v1M16 11a3 3 0 100-6M21 20v-1a4 4 0 00-3-3.9',
  leaders: 'M12 3l2.7 5.5 6 .9-4.4 4.2 1 6L12 16.8 6.7 19.6l1-6L3.3 9.4l6-.9z',
  prayer: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
  verify: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  me: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a6 6 0 0116 0v1',
  contact: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z'
};
const svg = (d, w) => '<svg viewBox="0 0 24 24" width="' + w + '" height="' + w + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
const st = document.createElement('style');
st.textContent = '.fm{display:none}' +
'@media (max-width:' + BP + 'px){' + (church ? '.fabs{display:none!important}.tabs{display:none!important}.shell{padding-bottom:40px!important}#toast{bottom:24px!important}' : 'nav.links{display:none}html{scroll-padding-top:76px}') + '.fm{display:block}.fm[hidden]{display:none}body:has(.modal,.lightbox) .fm:not(.open){display:none}}' +
'.fm-veil{position:fixed;inset:0;background:rgba(5,12,30,.55);opacity:0;pointer-events:none;transition:opacity .25s;z-index:70}' +
'.fm.open .fm-veil{opacity:1;pointer-events:auto}' +
'.fm-btn{position:fixed;right:14px;bottom:calc(190px + env(safe-area-inset-bottom,0px));width:52px;height:52px;border-radius:50%;border:0;padding:0;background:var(--accent,var(--blue,#1d5fd8));color:#fff;display:grid;place-items:center;cursor:pointer;z-index:30;box-shadow:0 6px 18px rgba(10,30,60,.38)}' +
'.fm.open .fm-btn{z-index:72}.fm-btn:focus-visible,.fm-it:focus-visible .fm-ic{outline:3px solid #e3a72b;outline-offset:3px}' +
'.fm-btn svg{grid-area:1/1;transition:transform .25s,opacity .2s}.fm-btn .fm-x{opacity:0;transform:rotate(-90deg)}.fm.open .fm-btn .fm-m{opacity:0;transform:rotate(90deg)}.fm.open .fm-btn .fm-x{opacity:1;transform:none}' +
'.fm-list{position:fixed;inset:0;pointer-events:none;z-index:71}' +
'.fm-it{position:absolute;display:flex;flex-direction:row-reverse;align-items:center;gap:7px;text-decoration:none;color:var(--ink,#10233f);opacity:0;visibility:hidden;transform:translateX(30px) scale(.4);transform-origin:right center;transition:transform .28s cubic-bezier(.3,1.4,.5,1),opacity .2s,visibility 0s .3s}' +
'.fm.open .fm-it{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition:transform .28s cubic-bezier(.3,1.4,.5,1),opacity .2s,visibility 0s}' +
'.fm-ic{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--surface,#fff);color:var(--accent,var(--blue,#1d5fd8));border:1px solid var(--line,#d6e4f8);flex:none;box-shadow:0 3px 10px rgba(10,30,60,.25)}' +
'.fm-lb{font:600 .8rem/1 inherit;background:var(--surface,#fff);color:var(--ink,#10233f);border:1px solid var(--line,#d6e4f8);border-radius:999px;padding:7px 11px;white-space:nowrap;box-shadow:0 3px 10px rgba(10,30,60,.2)}' +
'.fm-ic{position:relative}.fm-bd{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#d64550;color:#fff;font:700 .66rem/18px system-ui,sans-serif;text-align:center}.fm-bd[hidden]{display:none}' +
'.fm-it.on .fm-ic{background:var(--accent,var(--blue,#1d5fd8));color:#fff}' +
'@media (prefers-reduced-motion:reduce){.fm-it,.fm-btn svg,.fm-veil{transition:none!important}}@media print{.fm{display:none!important}}';
document.head.appendChild(st);

const root = document.createElement('div'); root.className = 'fm'; root.setAttribute('data-notr', '');
root.innerHTML = '<div class="fm-veil"></div><nav class="fm-list" aria-label="Sections"></nav>' +
  '<button type="button" class="fm-btn" aria-expanded="false" aria-haspopup="true">' + svg('M4 7h16M4 12h16M4 17h16', 24).replace('<svg ', '<svg class="fm-m" ') + svg('M6 6l12 12M18 6L6 18', 24).replace('<svg ', '<svg class="fm-x" ') + '<span class="fm-bd" hidden></span></button>';
document.body.appendChild(root);
const btn = root.querySelector('.fm-btn'), list = root.querySelector('.fm-list'), veil = root.querySelector('.fm-veil');
const esc2 = x => String(x).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const label = () => document.documentElement.lang === 'ceb' ? 'Menu: ablihi ang tanang bahin' : 'Menu: open all sections';

/* the button sits higher on tall screens and lower on short or sideways ones, so the whole arc always fits */
function geom() {
  const H = innerHeight, btm = Math.max(96, Math.min(190, Math.round(H * 0.3)));
  return { btm, bottomC: btm + 26 };
}
function place() { btn.style.bottom = geom().btm + 'px'; }
function badge() {
  const mb = church && document.querySelector('#msgBadge'), on = !!(mb && !mb.hidden && mb.textContent.trim()), t = on ? mb.textContent.trim() : '';
  const fb = btn.querySelector('.fm-bd'); fb.hidden = !on; fb.textContent = t; return { on, t };
}
function pseudo(text, route, from, click) {
  const pa = document.createElement('a'); pa.href = '#' + route; pa.setAttribute('data-route', route);
  const sv = from && from.querySelector('svg'); pa.innerHTML = (sv ? sv.outerHTML : '') + '<span>' + text + '</span>'; pa.click = click; return pa;
}
function build() {
  const ceb = document.documentElement.lang === 'ceb';
  const links = [...nav.querySelectorAll('a')];
  if (church) {   /* Chat and Game used to float on their own. They live here now, so there is one button instead of three. */
    const fabs = document.querySelector('#fabs'), chat = document.querySelector('#fabChat'), game = document.querySelector('#fabGame');
    if (fabs && fabs.classList.contains('on')) {
      if (chat && !chat.hidden) links.push(pseudo('Chat', 'fmchat', chat, () => chat.click()));
      if (game && !game.hidden) links.push(pseudo(ceb ? 'Dula' : 'Game', 'fmgame', game, () => game.click()));
    }
  }
  const meBtn = church && document.querySelector('#meBtn');
  if (meBtn && !meBtn.hidden) links.push(pseudo(ceb ? 'Akong profile' : 'My profile', 'me', null, () => meBtn.click()));
  const n = links.length;
  const H = innerHeight, bottomC = geom().bottomC, half = (n - 1) / 2;
  /* rows are spaced evenly down the screen and bulge out along a circle, so nothing bunches up at the ends */
  const avail = Math.min(bottomC - 14, H - bottomC - 70), p = Math.max(26, Math.min(42, avail / half)), R = half * p + 16;
  list.innerHTML = '';
  links.forEach((a, i) => {
    const key = church ? (a.getAttribute('data-route') || (a.getAttribute('href') || '').replace(/\W/g, '')) : (a.getAttribute('href') || '').replace('#', ''), yy = (i - half) * p, xx = Math.sqrt(Math.max(0, R * R - yy * yy));
    const it = document.createElement('a'); it.className = 'fm-it' + (a.classList.contains('on') ? ' on' : ''); it.href = a.getAttribute('href');
    it.style.right = (40 + xx - 20) + 'px'; it.style.bottom = (bottomC - yy - 20) + 'px'; it.style.transitionDelay = (i * 18) + 'ms';
    const map = { news: 'news', churches: 'churches', events: 'events', gallery: 'gallery', ministries: 'ministries', leaders: 'leaders', prayer: 'prayer', verify: 'verify', contact: 'contact', me: 'me' };
    const own = (church || a.dataset.route) && a.querySelector('svg');
    it.innerHTML = '<span class="fm-ic">' + (own ? own.outerHTML : svg(ICONS[map[key]] || ICONS.churches, 20)) + '</span><span class="fm-lb"></span>';
    if (own) { const sv = it.querySelector('svg'); sv.setAttribute('width', 20); sv.setAttribute('height', 20); }
    if (church && key === 'fmchat') { const bg = badge(); if (bg.on) it.querySelector('.fm-ic').insertAdjacentHTML('beforeend', '<span class="fm-bd">' + esc2(bg.t) + '</span>'); }
    it.querySelector('.fm-lb').textContent = (a.querySelector('span') || a).textContent.trim();
    it.addEventListener('click', e => {
      if (church) { e.preventDefault(); close(false); a.click(); return; }   /* the church site's own router does the rest */
      const t = document.querySelector(it.getAttribute('href')); if (!t) return; e.preventDefault(); close(false);
      t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      try { history.replaceState(null, '', it.getAttribute('href')); } catch (er) {}
    });
    list.appendChild(it);
  });
}
function open() { build(); if (!list.children.length) return; root.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); requestAnimationFrame(() => { const f = list.querySelector('.fm-it.on') || list.querySelector('.fm-it'); if (f) f.focus({ preventScroll: true }); }); }
function close(refocus) { root.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); if (refocus !== false) btn.focus({ preventScroll: true }); }
btn.addEventListener('click', () => root.classList.contains('open') ? close() : open());
veil.addEventListener('click', () => close());
addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('open')) close(); });
addEventListener('resize', () => { if (root.classList.contains('open')) { if (innerWidth > BP) close(false); else { place(); build(); root.classList.add('open'); } } else place(); });
const sync = () => { btn.setAttribute('aria-label', label()); btn.title = label(); root.hidden = !nav.querySelector('a'); place(); badge(); if (root.hidden && root.classList.contains('open')) close(false); };
sync(); setInterval(sync, 2000); addEventListener('orientationchange', () => setTimeout(() => { sync(); if (root.classList.contains('open')) { build(); root.classList.add('open'); } }, 250));
})();
