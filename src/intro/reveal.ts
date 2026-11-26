/** Staggered hero reveal (Podium Light): bands → rings → wordmark → underline → tiles. */
import { gsap } from 'gsap';
import { replayCountUp } from '../motion';
import { fmtInt } from '../format';

export interface RevealOptions {
  /** prefers-reduced-motion: opacity-only fade ≤400 ms, no stagger/transforms */
  reduced?: boolean;
  /** jump to the end state quickly (~300 ms), e.g. after "Skip intro" */
  fast?: boolean;
}

const HERO_NUM_IDS = ['hero-games', 'hero-athletes', 'hero-entries', 'hero-medals'];

/** Split each wordmark line into per-letter inline-blocks (same font-size, baseline-aligned). */
function splitWordmark(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.hero__line').forEach((line) => {
    if (line.dataset.split) return;
    const text = line.textContent ?? '';
    line.textContent = '';
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'hero__ch';
      s.textContent = ch === ' ' ? ' ' : ch;
      line.appendChild(s);
    }
    line.dataset.split = '1';
  });
}

function done(): void {
  window.__heroReady = true;
}

export function revealHero(opts: RevealOptions = {}): Promise<void> {
  const hero = document.querySelector<HTMLElement>('.hero')!;
  const d = document.documentElement;
  const q = <T extends Element = HTMLElement>(sel: string) => Array.from(hero.querySelectorAll<T & Element>(sel));
  const inner = hero.querySelector<HTMLElement>('.hero__inner')!;
  const bandsWrap = hero.querySelector<HTMLElement>('.hero__bands')!;

  if (opts.reduced) {
    gsap.set([inner, bandsWrap], { opacity: 0 });
    d.classList.remove('hero-pending');
    return new Promise((resolve) => {
      gsap.to([inner, bandsWrap], {
        opacity: 1, duration: 0.35, ease: 'power1.out', clearProps: 'opacity',
        onComplete: () => { done(); resolve(); },
      });
    });
  }

  splitWordmark(hero);
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, paused: true });
  tl.from(q('.hero__band'), { yPercent: -115, duration: 1.0, stagger: 0.075, ease: 'expo.out' }, 0)
    .from(q('.hero__eyebrow'), { opacity: 0, y: 12, duration: 0.55 }, 0.1)
    .from(q('.hero__rings'), { opacity: 0, scale: 0.82, duration: 0.8, ease: 'expo.out' }, 0.12)
    .from(q('.hero__title-a .hero__ch'), { yPercent: 112, duration: 0.6, stagger: 0.022, ease: 'expo.out' }, 0.22)
    .from(q('.hero__title-b .hero__ch'), { yPercent: 108, duration: 0.75, stagger: 0.035, ease: 'expo.out' }, 0.3)
    .from(q('.hero__underline'), { scaleX: 0, duration: 0.6, ease: 'expo.inOut' }, 0.62)
    .from(q('.hero__sub'), { opacity: 0, y: 14, duration: 0.6 }, 0.55)
    .from(q('.hero-stat'), { opacity: 0, y: 26, duration: 0.6, stagger: 0.07 }, 0.62)
    .from(q('.hero__scope'), { opacity: 0, duration: 0.5 }, 0.9);

  tl.progress(0); // apply from-states before un-hiding → no flash
  d.classList.remove('hero-pending');

  if (opts.fast) {
    tl.timeScale(tl.duration() / 0.3);
    HERO_NUM_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el?.dataset.value) replayCountUp(el, fmtInt, 300);
    });
  } else {
    // Numbers count up visibly with the tiles, even if main.ts already finished its own count-up.
    gsap.delayedCall(0.7, () => {
      HERO_NUM_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) replayCountUp(el, fmtInt, id === 'hero-games' ? 800 : 1200);
      });
    });
  }

  return new Promise((resolve) => {
    tl.eventCallback('onComplete', () => {
      // Leave no inline transforms behind once finished.
      gsap.set(q('.hero__band, .hero__eyebrow, .hero__rings, .hero__ch, .hero__underline, .hero__sub, .hero-stat, .hero__scope'), { clearProps: 'transform,opacity' });
      done();
      resolve();
    });
    tl.play();
  });
}
