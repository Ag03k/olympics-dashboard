/**
 * Aerial "camera drop" opening (~4.6 s):
 *   0–1.6 s   starfield + night globe, host cities light up chronologically 1896 → 2026
 *   1.6–3.4 s globe turns to Milano–Cortina and the camera descends (projection scale ×1 → ×60, expo.inOut)
 *   3.0–4.0 s cross into a hand-built SVG aerial of a stadium, still descending
 *   3.85–4.6 s the infield irises open onto the paper hero; overlay removed; hero reveal plays
 * Skip: button, wheel, any key, pointer → ~300 ms to the hero's end state.
 */
import { gsap } from 'gsap';
import { drawGlobe, drawCity, fitCanvas, geoOrthographic } from './geo';
import { hostPoints, DESCENT_TARGET, type HostPoint } from './hostCities';
import { stadiumSvg } from './stadium';
import { revealHero } from './reveal';
import type { GameLite } from './boot';
import './intro.css';

const ZOOM = 60;
const T = {
  rotate: 1.6,
  zoomEnd: 3.4,
  stadium: 3.0,
  iris: 3.85,
  reveal: 4.05,
  end: 4.6,
};

interface Star { x: number; y: number; r: number; a: number }

function makeStars(w: number, h: number, dpr: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const n = Math.round((w * h) / 1500);
  const stars: Star[] = [];
  for (let i = 0; i < n; i++) {
    stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() < 0.92 ? 0.35 + Math.random() * 0.45 : 0.8 + Math.random() * 0.6, a: 0.25 + Math.random() * 0.7 });
  }
  for (const s of stars) {
    ctx.fillStyle = `rgba(235, 240, 255, ${s.a.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  return cv;
}

export async function playIntro(gamesP: Promise<GameLite[]>): Promise<void> {
  const d = document.documentElement;
  const root = document.createElement('div');
  root.className = 'intro';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Opening animation');
  root.innerHTML = `
    <canvas class="intro__sky" aria-hidden="true"></canvas>
    <div class="intro__stadium" aria-hidden="true">${stadiumSvg()}</div>
    <p class="intro__year" aria-hidden="true"><span>Host cities</span><b>1896</b></p>
    <p class="intro__label" aria-hidden="true"><i></i>Milano–Cortina 2026</p>
    <button class="intro__skip" type="button">Skip intro</button>`;
  document.body.appendChild(root);
  d.classList.remove('intro-cover');

  const cv = root.querySelector<HTMLCanvasElement>('.intro__sky')!;
  const ctx = cv.getContext('2d')!;
  const stadium = root.querySelector<HTMLElement>('.intro__stadium')!;
  const yearEl = root.querySelector<HTMLElement>('.intro__year b')!;
  const yearWrap = root.querySelector<HTMLElement>('.intro__year')!;
  const label = root.querySelector<HTMLElement>('.intro__label')!;
  const skipBtn = root.querySelector<HTMLButtonElement>('.intro__skip')!;

  let size = fitCanvas(cv);
  let stars = makeStars(size.w, size.h, size.dpr);
  const onResize = () => {
    size = fitCanvas(cv);
    stars = makeStars(size.w, size.h, size.dpr);
  };
  window.addEventListener('resize', onResize);

  // Wait for the Games list (already downloading in parallel), but never hold the intro for long.
  const games = await Promise.race([gamesP, new Promise<GameLite[]>((r) => setTimeout(() => r([]), 1500))]);
  const points = hostPoints(games).filter((p): p is HostPoint => !!p);

  const proj = geoOrthographic().clipAngle(90).precision(0.6);
  const st = {
    lon: -78, lat: 12,       // view centre
    k: 0.86, globeA: 0, starsA: 0,
    lit: 0,
    pinA: 0,
  };

  const render = () => {
    const { w, h } = size;
    ctx.clearRect(0, 0, w, h);
    const zoom = Math.max(1, st.k);
    // Stars stream outward slightly with the descent, and fade as the globe fills the frame.
    const sa = st.starsA * Math.max(0, 1 - Math.log(zoom) / Math.log(6));
    if (sa > 0.01) {
      const s = Math.pow(zoom, 0.35);
      ctx.globalAlpha = sa;
      ctx.drawImage(stars, (w - w * s) / 2, (h - h * s) / 2, w * s, h * s);
      ctx.globalAlpha = 1;
    }
    if (st.globeA > 0.005) {
      const r0 = Math.min(w, h) * 0.34;
      proj.scale(r0 * st.k).translate([w / 2, h / 2]).rotate([-st.lon, -st.lat]).clipExtent([[-40, -40], [w + 40, h + 40]]);
      ctx.globalAlpha = st.globeA;
      drawGlobe(ctx, proj, { glow: 1, line: Math.min(2.2, 1 + Math.log(zoom) * 0.3) });
      const dot = Math.min(3.2, 1.6 * Math.pow(zoom, 0.25));
      const litN = st.lit;
      for (let i = 0; i < points.length && i < litN; i++) {
        const p = points[i];
        const xy = proj([p.lon, p.lat]);
        if (!xy || !isFront(p)) continue;
        if (xy[0] < -20 || xy[1] < -20 || xy[0] > w + 20 || xy[1] > h + 20) continue;
        const age = litN - i;
        drawCity(ctx, xy[0], xy[1], p, Math.min(1, age * 1.5), dot, Math.max(0, 1 - age / 4));
      }
      if (st.pinA > 0.01) {
        const xy = proj([DESCENT_TARGET.lon, DESCENT_TARGET.lat]);
        if (xy) {
          const t = (performance.now() / 1000) % 1.1 / 1.1;
          ctx.strokeStyle = `rgba(255, 252, 244, ${(st.pinA * (1 - t)).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(xy[0], xy[1], 6 + t * 26, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = `rgba(238, 51, 78, ${st.pinA.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(xy[0], xy[1], 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${st.pinA.toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          label.style.transform = `translate(${xy[0].toFixed(1)}px, ${(xy[1] + 22).toFixed(1)}px) translateX(-50%)`;
        }
      }
      ctx.globalAlpha = 1;
    }
    const idx = Math.min(points.length - 1, Math.floor(st.lit));
    if (idx >= 0) {
      const y = String(points[idx].year);
      if (yearEl.textContent !== y) yearEl.textContent = y;
    }
  };
  const isFront = (p: { lon: number; lat: number }) => {
    const rot = proj.rotate();
    const toRad = Math.PI / 180;
    const [l1, p1] = [p.lon * toRad, p.lat * toRad];
    const [l0, p0] = [-rot[0] * toRad, -rot[1] * toRad];
    return Math.sin(p0) * Math.sin(p1) + Math.cos(p0) * Math.cos(p1) * Math.cos(l1 - l0) > 0.02;
  };

  gsap.ticker.add(render);

  let finished = false;
  let revealStarted = false;
  let resolveDone!: () => void;
  const donePromise = new Promise<void>((r) => (resolveDone = r));

  const cleanup = () => {
    if (finished) return;
    finished = true;
    gsap.ticker.remove(render);
    window.removeEventListener('resize', onResize);
    removeSkipListeners();
    root.remove();
    d.classList.remove('intro-lock', 'intro-cover');
    window.__introDone = true;
    resolveDone();
  };
  const startReveal = (fast = false) => {
    if (revealStarted) return;
    revealStarted = true;
    void revealHero({ fast });
  };

  // Zoom is interpolated in log space so the descent feels like constant-rate falling.
  const zoom = { p: 0 };
  const lnZ = Math.log(ZOOM);
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to(st, { starsA: 1, duration: 0.5, ease: 'power1.out' }, 0)
    .to(st, { globeA: 1, k: 1, duration: 0.9, ease: 'power3.out' }, 0.05)
    .to(st, { lon: -28, lat: 26, duration: T.rotate, ease: 'sine.inOut' }, 0)
    .to(st, { lit: points.length, duration: 1.4, ease: 'none' }, 0.15)
    .from(yearWrap, { opacity: 0, y: 8, duration: 0.4, ease: 'power2.out' }, 0.15)
    .to(yearWrap, { opacity: 0, duration: 0.35 }, 1.75)
    // Phase 2: turn to Milano–Cortina and descend.
    .to(st, { lon: DESCENT_TARGET.lon, lat: DESCENT_TARGET.lat, duration: 1.0, ease: 'power2.inOut' }, T.rotate)
    .to(zoom, {
      p: 1, duration: T.zoomEnd - T.rotate, ease: 'expo.inOut',
      onUpdate: () => { st.k = Math.exp(lnZ * zoom.p); },
    }, T.rotate)
    .to(st, { pinA: 1, duration: 0.3, ease: 'power2.out' }, 2.15)
    .fromTo(label, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 2.3)
    .to([label], { opacity: 0, duration: 0.25 }, 3.05)
    .to(st, { pinA: 0, duration: 0.25 }, 3.05)
    // Phase 3: stadium aerial rises out of the city, still descending.
    .fromTo(stadium, { opacity: 0, scale: 0.1 }, { opacity: 1, duration: 0.4, ease: 'power2.out' }, T.stadium)
    .to(stadium, { scale: 1.25, duration: T.iris - T.stadium, ease: 'expo.in' }, T.stadium)
    .to(st, { globeA: 0, duration: 0.6, ease: 'power1.in' }, 3.2)
    // Phase 4: infield irises open onto the hero.
    .set(root, { '--iris': '0px' }, T.iris)
    .call(() => root.classList.add('is-iris'), [], T.iris)
    .to(stadium, { scale: 3.4, duration: T.end - T.iris, ease: 'power2.in' }, T.iris)
    .to(root, { '--iris': () => `${Math.ceil(Math.hypot(size.w, size.h) / 2 + 40)}px`, duration: T.end - T.iris, ease: 'power3.in' }, T.iris)
    .call(() => startReveal(), [], T.reveal)
    .call(cleanup, [], T.end);

  // ---------- Skip ----------
  const skip = () => {
    if (finished) return;
    tl.kill();
    removeSkipListeners();
    startReveal(true);
    gsap.to(root, { opacity: 0, duration: 0.25, ease: 'power2.out', onComplete: cleanup });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
    skip();
  };
  const listeners: [string, EventListener, AddEventListenerOptions][] = [
    ['wheel', skip, { passive: true }],
    ['touchmove', skip, { passive: true }],
    ['pointerdown', skip, { passive: true }],
    ['keydown', onKey as EventListener, {}],
  ];
  listeners.forEach(([t, fn, o]) => window.addEventListener(t, fn, o));
  skipBtn.addEventListener('click', skip);
  function removeSkipListeners(): void {
    listeners.forEach(([t, fn, o]) => window.removeEventListener(t, fn, o));
  }

  return donePromise;
}
