/** Live prefers-reduced-motion tracking and small animation helpers. */
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
const listeners = new Set<(reduced: boolean) => void>();

export function reducedMotion(): boolean {
  return mq.matches;
}

export function onReducedMotionChange(fn: (reduced: boolean) => void): void {
  listeners.add(fn);
}

mq.addEventListener('change', () => {
  document.documentElement.classList.toggle('reduced-motion', mq.matches);
  listeners.forEach((fn) => fn(mq.matches));
});
document.documentElement.classList.toggle('reduced-motion', mq.matches);

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
const running = new WeakMap<HTMLElement, number>();

/**
 * Animate a number inside `el` from its previous value to `to`.
 * `format` renders the value; null `to` renders the empty placeholder immediately.
 */
export function countUp(
  el: HTMLElement,
  to: number | null,
  format: (v: number | null) => string,
  duration = 900,
): void {
  const prevRaf = running.get(el);
  if (prevRaf) cancelAnimationFrame(prevRaf);
  const finalText = format(to);
  el.setAttribute('aria-label', finalText);
  const prev = el.dataset.value;
  const from = prev ? Number(prev) : 0;
  if (to == null) {
    el.dataset.value = '';
    el.textContent = finalText;
    return;
  }
  el.dataset.value = String(to);
  if (reducedMotion() || document.hidden || from === to || !Number.isFinite(from)) {
    el.textContent = finalText;
    return;
  }
  animate(el, from, to, format, duration);
}

function animate(el: HTMLElement, from: number, to: number, format: (v: number | null) => string, duration: number) {
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / duration);
    const v = from + (to - from) * easeOut(t);
    el.textContent = t < 1 ? format(v) : format(to);
    if (t < 1) running.set(el, requestAnimationFrame(step));
    else running.delete(el);
  };
  running.set(el, requestAnimationFrame(step));
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let t: number | undefined;
  return (...args: A) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}
