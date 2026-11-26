/**
 * "Google Earth" opening (~6 s): a real satellite-imagery globe (WebGL, src/intro/earth.ts) zooms
 * from the whole planet down to Stadio San Siro, Milan (Milano–Cortina 2026 opening ceremony).
 *   0–0.6 s   Earth fades in from black, small and slowly turning (centred ~30° N, 40° W)
 *   0.4–2.2 s turn to San Siro while descending to continent scale (~0.6 R)
 *   2.0–5.2 s continuous exponential descent straight down to a ~4 km-wide aerial view
 *   4.0–5.2 s label + lat/lon readout + pin pulse
 *   5.2–6.0 s iris opens onto the paper hero; hero reveal plays; GL context released
 * No WebGL, or base imagery not ready within 2.5 s → straight to the hero reveal.
 * Skip: button, wheel, any key, pointer → ~300 ms to the hero's end state.
 */
import { gsap } from 'gsap';
import { createGlobe, type Camera } from './earth';
import { revealHero } from './reveal';
import type { GameLite } from './boot';
import './intro.css';

const TARGET = { lat: 45.4781, lon: 9.124 }; // Stadio Giuseppe Meazza (San Siro)
const START = { lat: 30, lon: -46, alt: 4 };
const MID_ALT = 0.6;
const END_WIDTH_KM = 4;
const LOAD_TIMEOUT = 2500;
const T = { label: 4.0, land: 5.2, reveal: 5.35, end: 6.0 };

const fmtLat = (v: number) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? 'N' : 'S'}`;
const fmtLon = (v: number) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? 'E' : 'W'}`;

export async function playIntro(_games?: Promise<GameLite[]>): Promise<void> {
  const d = document.documentElement;
  const root = document.createElement('div');
  root.className = 'intro';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Opening animation');
  root.innerHTML = `
    <canvas class="intro__gl" aria-hidden="true"></canvas>
    <div class="intro__pin" aria-hidden="true"><i></i><i></i></div>
    <div class="intro__label" aria-hidden="true">
      <p class="intro__name"><i></i>Milano–Cortina 2026 · Stadio San Siro</p>
      <p class="intro__coords">${fmtLat(TARGET.lat)}&nbsp;&nbsp;${fmtLon(TARGET.lon)}</p>
    </div>
    <p class="intro__credit">Imagery: NASA Blue Marble · Sentinel-2 cloudless 2016 by EOX (CC BY 4.0)</p>
    <button class="intro__skip" type="button">Skip intro</button>`;
  document.body.appendChild(root);
  d.classList.remove('intro-cover');

  const canvas = root.querySelector<HTMLCanvasElement>('.intro__gl')!;
  const pin = root.querySelector<HTMLElement>('.intro__pin')!;
  const label = root.querySelector<HTMLElement>('.intro__label')!;
  const coords = root.querySelector<HTMLElement>('.intro__coords')!;
  const credit = root.querySelector<HTMLElement>('.intro__credit')!;
  const skipBtn = root.querySelector<HTMLButtonElement>('.intro__skip')!;

  let finished = false;
  let revealStarted = false;
  let raf = 0;
  let tl: gsap.core.Timeline | null = null;
  let resolveDone!: () => void;
  const donePromise = new Promise<void>((r) => (resolveDone = r));

  const globe = (() => {
    try {
      return createGlobe(canvas);
    } catch (e) {
      console.warn('Intro globe unavailable', e);
      return null;
    }
  })();

  const onResize = () => globe?.resize();
  window.addEventListener('resize', onResize);

  const cleanup = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    tl?.kill();
    window.removeEventListener('resize', onResize);
    removeSkipListeners();
    globe?.dispose();
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
  /** Bail out to the regular hero reveal (no WebGL / imagery too slow). */
  const fallback = () => {
    if (finished) return;
    removeSkipListeners();
    startReveal();
    gsap.to(root, { opacity: 0, duration: 0.3, ease: 'power2.out', onComplete: cleanup });
  };

  // ---------- Skip ----------
  const skip = () => {
    if (finished) return;
    tl?.kill();
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

  if (!globe) {
    fallback();
    return donePromise;
  }
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (!finished && !revealStarted) fallback();
  });

  const ok = await Promise.race([globe.ready, new Promise<boolean>((r) => setTimeout(() => r(false), LOAD_TIMEOUT))]);
  if (finished) return donePromise;
  if (!ok) {
    fallback();
    return donePromise;
  }

  // ---------- Camera choreography ----------
  // lat/lon: slow drift, blended to the target by `turn`. Altitude: log-space, two additive legs.
  const st = { drift: 0, turn: 0, legA: 0, legB: 0, fade: 0, read: 0 };
  const lnStart = Math.log(START.alt);
  const lnMid = Math.log(MID_ALT);
  let lnEnd = Math.log(globe.altitudeForWidth(END_WIDTH_KM));
  const cam: Camera = { lat: START.lat, lon: START.lon, alt: START.alt, fade: 0 };

  const frame = () => {
    if (finished) return;
    lnEnd = Math.log(globe.altitudeForWidth(END_WIDTH_KM)); // tracks the viewport aspect
    const lon0 = START.lon + 14 * st.drift;
    const lat0 = START.lat + 2 * st.drift;
    cam.lon = lon0 + (TARGET.lon - lon0) * st.turn;
    cam.lat = lat0 + (TARGET.lat - lat0) * st.turn;
    cam.alt = Math.exp(lnStart + (lnMid - lnStart) * st.legA + (lnEnd - lnMid) * st.legB);
    cam.fade = st.fade;
    globe.draw(cam);
    if (st.read > 0) {
      const k = 1 - st.read;
      coords.textContent = `${fmtLat(TARGET.lat - 0.0386 * k)}  ${fmtLon(TARGET.lon - 0.0517 * k)}`;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to(st, { fade: 1, duration: 0.6, ease: 'power1.out' }, 0)
    .fromTo(credit, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' }, 0.2)
    .to(st, { drift: 1, duration: 2.2, ease: 'sine.out' }, 0)
    .to(st, { turn: 1, duration: 1.8, ease: 'power2.inOut' }, 0.4)
    .to(st, { legA: 1, duration: 1.8, ease: 'sine.inOut' }, 0.4)
    .to(st, { legB: 1, duration: T.land - 2.0, ease: 'power2.inOut' }, 2.0)
    // Arrival: label, ticking coordinates, pin pulse.
    .fromTo(label, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, T.label)
    .to(st, { read: 1, duration: 1.0, ease: 'power2.out' }, T.label)
    .call(() => pin.classList.add('is-on'), [], T.label + 0.15)
    .to([label, pin, credit, skipBtn], { opacity: 0, duration: 0.3, ease: 'power1.in' }, T.land + 0.05)
    // Iris opens onto the hero.
    .set(root, { '--iris': '0px' }, T.land)
    .call(() => root.classList.add('is-iris'), [], T.land)
    .to(root, { '--iris': () => `${Math.ceil(Math.hypot(window.innerWidth, window.innerHeight) / 2 + 40)}px`, duration: T.end - T.land, ease: 'power3.in' }, T.land)
    .call(() => startReveal(), [], T.reveal)
    .call(cleanup, [], T.end);

  return donePromise;
}
