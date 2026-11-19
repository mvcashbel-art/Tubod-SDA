/* Animations for the Tubod church site: scroll reveal, page fade, top progress bar. */
(() => {
'use strict';
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const $ = s => document.querySelector(s);
let io = null;
function reveal() {
  if (REDUCE || !('IntersectionObserver' in window)) return;
  if (!io) io = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return; const el = en.target; io.unobserve(el); el.classList.add('in'); el.dataset.seen = '1';
    setTimeout(() => el.classList.remove('rv', 'in'), 1200);
  }), { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  document.querySelectorAll('#view .card:not(.auth-card), #side .card').forEach(el => {
    if (el.dataset.seen || el.classList.contains('rv')) return;
    if (el.getBoundingClientRect().top < innerHeight * 0.95) { el.dataset.seen = '1'; return; }
    const k = Array.prototype.indexOf.call(el.parentNode.children, el);
    el.style.setProperty('--d', Math.min(k, 5) * 0.06 + 's'); el.classList.add('rv'); io.observe(el);
  });
}
let queued = false;
function tick() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; reveal(); }); }
function init() {
  const bar = document.createElement('div'); bar.id = 'coolProgress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  const upd = () => { const mx = root.scrollHeight - root.clientHeight; bar.style.width = (mx > 0 ? Math.min(100, root.scrollTop / mx * 100) : 0) + '%'; };
  addEventListener('scroll', upd, { passive: true }); upd();
  const mo = new MutationObserver(tick);
  ['#view', '#side'].forEach(s => { const el = $(s); if (el) mo.observe(el, { childList: true }); });
  document.addEventListener('click', e => {
    if (REDUCE || !e.target.closest('[data-route]')) return;
    const v = $('#view'); if (!v) return; v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in'); setTimeout(() => v.classList.remove('view-in'), 500);
  });
  tick();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
