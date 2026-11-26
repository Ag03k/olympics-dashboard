/**
 * Opening sequence entry point (tiny; lives in the main bundle).
 * The mode is decided by the inline script in index.html (html[data-intro]):
 *   intro   → real-imagery Earth zoom to San Siro (WebGL), then the hero reveal
 *   nointro → ?nointro=1: hero reveal only
 *   reduced → prefers-reduced-motion: a short opacity fade, no transforms
 *   static  → ?static=1: final state immediately
 * Heavy code (GSAP, WebGL globe, imagery) is lazy-loaded so the dashboard boot is never blocked.
 */
export type IntroMode = 'intro' | 'nointro' | 'reduced' | 'static';

export interface GameLite {
  year: number;
  season: 'Summer' | 'Winter';
  city: string;
}

declare global {
  interface Window {
    __introDone?: boolean;
    __heroReady?: boolean;
  }
}

function finishStatic(): void {
  const d = document.documentElement;
  d.classList.remove('hero-pending', 'intro-cover', 'intro-lock');
  window.__introDone = true;
  window.__heroReady = true;
}

export function startHero(games: Promise<GameLite[]>): void {
  const d = document.documentElement;
  const mode = (d.dataset.intro as IntroMode | undefined) ?? 'nointro';
  if (mode === 'static') {
    finishStatic();
    return;
  }
  const fail = (err: unknown) => {
    console.warn('Hero animation unavailable', err);
    finishStatic();
  };
  if (mode === 'intro') {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    import('./intro')
      .then((m) => m.playIntro(games.catch(() => [])))
      .catch(fail);
    return;
  }
  window.__introDone = true;
  import('./reveal')
    .then((m) => m.revealHero({ reduced: mode === 'reduced' }))
    .catch(fail);
}
