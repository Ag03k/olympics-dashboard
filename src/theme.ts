/**
 * Theme tokens mirrored from src/styles/tokens.css for use in ECharts.
 * Keep these values identical to the CSS custom properties of the same name.
 */
import * as echarts from 'echarts/core';

export const tokens = {
  // Medal palette (--oly-gold, --oly-silver, --oly-bronze and "-ink" text variants)
  gold: '#d4af37',
  goldInk: '#7a5a00',
  goldContainer: '#fff0c2',
  silver: '#a9b1b9',
  silverInk: '#4f5a64',
  silverContainer: '#eef1f4',
  bronze: '#c87533',
  bronzeInk: '#8a4510',
  bronzeContainer: '#fbe6d4',
  onMedal: '#1d1600',
  // Ring colours (--oly-ring-*)
  ringBlue: '#0081c8',
  ringYellow: '#fcb131',
  ringBlack: '#000000',
  ringGreen: '#00a651',
  ringRed: '#ee334e',
  ringBlueInk: '#00639a',
  ringRedInk: '#b8122f',
  // Series (--oly-male / --oly-female)
  male: '#0081c8',
  female: '#ee334e',
  maleInk: '#00639a',
  femaleInk: '#b8122f',
  // M3 roles (--md-sys-color-*)
  primary: '#7a5a00',
  onPrimary: '#ffffff',
  primaryContainer: '#ffdf9b',
  surface: '#fff8f1',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#fcf2e5',
  surfaceContainer: '#f6ecdf',
  surfaceContainerHigh: '#f0e7d9',
  inverseSurface: '#353027',
  inverseOnSurface: '#f9efe2',
  onSurface: '#1f1b13',
  onSurfaceVariant: '#4d4639',
  outline: '#7f7667',
  outlineVariant: '#d0c5b4',
  // Typography (--oly-font-*)
  fontDisplay: '"Hubot Sans", "Mona Sans", system-ui, sans-serif',
  fontText: '"Mona Sans", system-ui, sans-serif',
  fontDigits: '"Martian Mono", ui-monospace, monospace',
  // Motion (--md-sys-motion-duration-long4)
  durationUpdate: 600,
  durationEnter: 900,
} as const;

/** Medal fill colours, in Gold / Silver / Bronze order. */
export const MEDAL_COLORS = [tokens.gold, tokens.silver, tokens.bronze] as const;
export const MEDAL_INKS = [tokens.goldInk, tokens.silverInk, tokens.bronzeInk] as const;
export const SEX_COLORS = [tokens.male, tokens.female] as const;

/** Sequential scale for the height × weight heatmap (cream → gold → deep bronze). */
export const HEAT_SCALE = ['#fff6dc', '#fde3a0', '#f2c45a', '#d4a12a', '#a8701a', '#6e430c', '#3d2304'];

/** CSS cubic-bezier(0.2, 0, 0, 1) — M3 "emphasized" easing — as a JS function. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-5) break;
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    t = Math.min(1, Math.max(0, t));
    return sy(t);
  };
}
export const emphasizedEasing = cubicBezier(0.2, 0, 0, 1);

const axisCommon = {
  axisLine: { show: true, lineStyle: { color: tokens.outlineVariant } },
  axisTick: { show: false },
  axisLabel: { color: tokens.onSurfaceVariant, fontFamily: tokens.fontText, fontSize: 12 },
  splitLine: { show: true, lineStyle: { color: '#ece3d4', type: 'dashed' as const } },
  nameTextStyle: { color: tokens.onSurfaceVariant, fontFamily: tokens.fontText, fontSize: 12 },
};

export function registerOlympiansTheme(): void {
  echarts.registerTheme('olympians', {
    color: [tokens.male, tokens.female, tokens.gold, tokens.silver, tokens.bronze, tokens.ringGreen, tokens.ringYellow],
    backgroundColor: 'transparent',
    textStyle: { fontFamily: tokens.fontText, color: tokens.onSurface },
    title: {
      textStyle: { fontFamily: tokens.fontDisplay, color: tokens.onSurface },
      subtextStyle: { color: tokens.onSurfaceVariant },
    },
    legend: {
      textStyle: { color: tokens.onSurfaceVariant, fontFamily: tokens.fontText, fontSize: 12 },
      itemGap: 16,
    },
    tooltip: {
      backgroundColor: tokens.inverseSurface,
      borderColor: tokens.inverseSurface,
      borderWidth: 0,
      padding: [8, 12],
      textStyle: { color: tokens.inverseOnSurface, fontFamily: tokens.fontText, fontSize: 13 },
      extraCssText: 'border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.25);',
      axisPointer: {
        lineStyle: { color: tokens.outline, type: 'dashed' },
        crossStyle: { color: tokens.outline },
        shadowStyle: { color: 'rgba(122, 90, 0, 0.08)' },
      },
    },
    categoryAxis: { ...axisCommon, splitLine: { show: false } },
    valueAxis: { ...axisCommon, axisLine: { show: false } },
    line: { symbol: 'circle', symbolSize: 7, smooth: false, lineStyle: { width: 3 } },
    bar: { itemStyle: { borderRadius: 0 } },
    markLine: { label: { color: tokens.onSurface } },
  });
}
