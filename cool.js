/* Shared polish for every church site: theme toggle, verse of the day, scroll reveal, progress bar. */
(() => {
'use strict';
const KEY = 'coolTheme:' + location.pathname;
const REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const $ = s => document.querySelector(s);
/* King James Version (public domain) */
const VERSES = [
  ['John 3:16', 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'],
  ['Psalm 23:1', 'The LORD is my shepherd; I shall not want.'],
  ['Psalm 46:1', 'God is our refuge and strength, a very present help in trouble.'],
  ['Proverbs 3:5-6', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.'],
  ['Isaiah 41:10', 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.'],
  ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
  ['Matthew 11:28', 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.'],
  ['Joshua 1:9', 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'],
  ['Romans 8:28', 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.'],
  ['Jeremiah 29:11', 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.'],
  ['Psalm 119:105', 'Thy word is a lamp unto my feet, and a light unto my path.'],
  ['Psalm 27:1', 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?'],
  ['Psalm 121:1-2', 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.'],
  ['Hebrews 11:1', 'Now faith is the substance of things hoped for, the evidence of things not seen.'],
  ['Revelation 3:20', 'Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me.'],
  ['2 Timothy 1:7', 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.'],
  ['Psalm 34:8', 'O taste and see that the LORD is good: blessed is the man that trusteth in him.'],
  ['Matthew 6:33', 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.'],
  ['Isaiah 40:31', 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'],
  ['Micah 6:8', 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?'],
  ['John 14:6', 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.'],
  ['John 14:27', 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.'],
  ['Romans 5:8', 'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.'],
  ['Ephesians 2:8', 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:'],
  ['Psalm 100:4', 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.'],
  ['Psalm 118:24', 'This is the day which the LORD hath made; we will rejoice and be glad in it.'],
  ['Lamentations 3:22-23', 'It is of the LORD’S mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.'],
  ['Psalm 19:1', 'The heavens declare the glory of God; and the firmament sheweth his handywork.'],
  ['Proverbs 18:10', 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.'],
  ['1 Peter 5:7', 'Casting all your care upon him; for he careth for you.'],
  ['James 1:5', 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.'],
  ['Psalm 91:1-2', 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.'],
  ['Isaiah 26:3', 'Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.'],
  ['Matthew 5:16', 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.'],
  ['Hebrews 13:8', 'Jesus Christ the same yesterday, and to day, and for ever.'],
  ['John 8:12', 'Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.'],
  ['Revelation 21:4', 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.'],
  ['1 Thessalonians 5:16-18', 'Rejoice evermore. Pray without ceasing. In every thing give thanks: for this is the will of God in Christ Jesus concerning you.'],
  ['Psalm 51:10', 'Create in me a clean heart, O God; and renew a right spirit within me.'],
  ['Deuteronomy 31:6', 'Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.'],
  ['Matthew 7:7', 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:'],
  ['Romans 15:13', 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.'],
  ['Psalm 16:11', 'Thou wilt shew me the path of life: in thy presence is fulness of joy; at thy right hand there are pleasures for evermore.'],
  ['Revelation 14:12', 'Here is the patience of the saints: here are they that keep the commandments of God, and the faith of Jesus.'],
  ['1 John 1:9', 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.'],
  ['Psalm 133:1', 'Behold, how good and how pleasant it is for brethren to dwell together in unity!'],
  ['1 Corinthians 13:13', 'And now abideth faith, hope, charity, these three; but the greatest of these is charity.'],
  ['Colossians 3:23', 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;'],
  ['Proverbs 22:6', 'Train up a child in the way he should go: and when he is old, he will not depart from it.']
];
const SABBATH_VERSES = [
  ['Exodus 20:8', 'Remember the sabbath day, to keep it holy.'],
  ['Genesis 2:3', 'And God blessed the seventh day, and sanctified it: because that in it he had rested from all his work which God had created and made.'],
  ['Mark 2:27', 'And he said unto them, The sabbath was made for man, and not man for the sabbath:']
];

const manila = () => new Date(Date.now() + 8 * 3600000);
function todays() {
  const mn = manila(), day = Math.floor(mn.getTime() / 864e5), sab = mn.getUTCDay() === 6, pool = sab ? SABBATH_VERSES : VERSES;
  return { v: pool[day % pool.length], sab };
}

/* ---- light / dark ---- */
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
function paint(b) { b.innerHTML = root.classList.contains('dk') ? SUN : MOON; b.title = 'Switch light or dark'; b.setAttribute('aria-label', 'Switch light or dark'); }
function mountTheme() {
  const r = $('.top-r'); if (!r || $('#themeBtn')) return;
  const b = document.createElement('button'); b.id = 'themeBtn'; b.type = 'button'; b.className = 'icon-btn'; b.setAttribute('data-notr', '');
  r.insertBefore(b, r.firstChild); paint(b);
  b.addEventListener('click', () => { root.classList.toggle('dk'); try { localStorage.setItem(KEY, root.classList.contains('dk') ? 'dark' : 'light'); } catch (e) {} paint(b); });
}

/* ---- verse of the day, under the Sabbath card on Home ---- */
function mountVerse() {
  const side = $('#side'); if (!side || side.hidden) return;
  const sc = side.querySelector('#sabbathCard'); if (!sc || side.querySelector('#votd')) return;
  const { v, sab } = todays(), d = document.createElement('div');
  d.className = 'card votd'; d.id = 'votd'; d.setAttribute('data-notr', '');
  d.innerHTML = '<h3>' + (sab ? 'Sabbath verse' : 'Verse of the day') + '</h3><p class="verse" lang="en">“' + v[1] + '”</p><p class="muted"><b>' + v[0] + '</b> · King James Version</p><div class="vb"><button type="button" data-cool="copy">Copy</button></div>';
  const slot = side.querySelector('#annSlot');   /* Sabbath card, then the one-line announcement, then the verse */
  (slot || sc).insertAdjacentElement('afterend', d);
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-cool="copy"]'); if (!b) return;
  const { v } = todays(); try { await navigator.clipboard.writeText('“' + v[1] + '” — ' + v[0] + ' (KJV)'); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1800); } catch (er) {}
});

/* ---- reveal cards as they scroll into view (cards already on screen are left alone, so nothing flashes) ---- */
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
function tick() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; mountTheme(); mountVerse(); reveal(); }); }

function init() {
  const bar = document.createElement('div'); bar.id = 'coolProgress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  const upd = () => { const h = root, mx = h.scrollHeight - h.clientHeight; bar.style.width = (mx > 0 ? Math.min(100, h.scrollTop / mx * 100) : 0) + '%'; };
  addEventListener('scroll', upd, { passive: true }); upd();
  const mo = new MutationObserver(tick);
  ['#view', '#side', '.top-r'].forEach(s => { const el = $(s); if (el) mo.observe(el, { childList: true }); });
  document.addEventListener('click', e => {
    if (REDUCE || !e.target.closest('[data-route]')) return;
    const v = $('#view'); if (!v) return; v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in'); setTimeout(() => v.classList.remove('view-in'), 500);
  });
  tick();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
