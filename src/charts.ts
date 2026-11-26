/**
 * ECharts option builders for the six Overview charts.
 * Every series and axis has a stable id so filter changes morph (setOption + replaceMerge).
 */
import * as echarts from 'echarts/core';
import { LineChart, BarChart, HeatmapChart, BoxplotChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  MarkAreaComponent,
  VisualMapComponent,
  TitleComponent,
  AxisPointerComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

import type { Summary, HeatBins, NocRow, BoxStats } from './data';
import { tokens, MEDAL_COLORS, HEAT_SCALE, emphasizedEasing, registerOlympiansTheme } from './theme';
import { fmtInt, fmtFixed, fmtPct, escapeHtml } from './format';

echarts.use([
  LineChart, BarChart, HeatmapChart, BoxplotChart,
  GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkPointComponent, MarkAreaComponent,
  VisualMapComponent, TitleComponent, AxisPointerComponent, CanvasRenderer,
]);
registerOlympiansTheme();

export interface ChartCtx {
  width: number;
  reduced: boolean;
}

export interface ChartResult {
  option: EChartsCoreOption | null;
  insight: string;
  summary: string;
  emptyTitle?: string;
  emptyText?: string;
  note?: string;
  height?: number;
}

export type TopMode = 'medals' | 'entries';

const SEX = ['Male', 'Female'] as const;
const fontSize = (ctx: ChartCtx) => (ctx.width < 480 ? 11 : 12);

function tooltipBase(): Record<string, unknown> {
  return {
    confine: true,
    triggerOn: 'mousemove|click',
    enterable: false,
    transitionDuration: 0.15,
  };
}

/** Hover state that never fades or darkens anything: no series focus/blur, full opacity kept. */
const NO_BLUR = { focus: 'none', blurScope: 'coordinateSystem' } as const;
const BLUR_KEEP = { itemStyle: { opacity: 1 }, lineStyle: { opacity: 1 }, label: { opacity: 1 } } as const;

/** Thin gold outline used as the hover cue on bars / cells / boxes (no shadow, no colour change). */
function ringEmphasis(width = 1.5): Record<string, unknown> {
  return { ...NO_BLUR, itemStyle: { borderColor: tokens.gold, borderWidth: width, shadowBlur: 0, shadowColor: 'transparent' } };
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function dot(color: string): string {
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;vertical-align:baseline"></span>`;
}

function row(color: string, label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:16px;align-items:center"><span>${dot(color)}${escapeHtml(label)}</span><b style="font-variant-numeric:tabular-nums">${value}</b></div>`;
}

function head(text: string, sub?: string): string {
  return `<div style="font-family:${tokens.fontDisplay};font-size:15px;letter-spacing:.02em;margin-bottom:4px">${escapeHtml(text)}</div>${
    sub ? `<div style="opacity:.8;font-size:12px;margin-bottom:6px;max-width:260px;white-space:normal">${escapeHtml(sub)}</div>` : ''
  }`;
}

function yearAxisRange(years: number[]): { min: number; max: number } {
  const min = years[0];
  const max = years[years.length - 1];
  if (min === max) return { min: min - 4, max: max + 4 };
  return { min, max };
}

/* ------------------------------------------------------------------ */
/* 1. Participation over time by sex                                   */
/* ------------------------------------------------------------------ */
export function participationChart(s: Summary, ctx: ChartCtx): ChartResult {
  const pts = s.participation;
  if (!pts.length) return emptyResult(s);
  const years = pts.map((p) => p.year);
  const { min, max } = yearAxisRange(years);
  const has1980 = years.includes(1980);
  const p1980 = pts.find((p) => p.year === 1980);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const share = (p: { male: number; female: number }) => fmtPct(p.female, p.male + p.female);
  const insight =
    pts.length > 1
      ? `Women went from ${share(first)} of entries in ${first.year} to ${share(last)} in ${last.year}.`
      : `${fmtInt(first.male + first.female)} athlete entries in ${first.year}; ${share(first)} by women.`;
  const summary = `Line chart of athlete entries per Games year by sex, ${first.year} to ${last.year}. ` +
    pts.map((p) => `${p.year}: ${fmtInt(p.male)} male, ${fmtInt(p.female)} female`).join('; ') + '.';

  const markLine = has1980 && p1980
    ? {
        silent: true,
        symbol: ['none', 'none'],
        animation: !ctx.reduced,
        lineStyle: { color: tokens.goldInk, type: 'dashed', width: 1.5 },
        label: { show: false },
        data: [{ xAxis: 1980 }],
      }
    : { data: [] };
  const nearStart = p1980 ? (1980 - min) / Math.max(1, max - min) < 0.5 : true;
  const markPoint = has1980 && p1980
    ? {
        animation: !ctx.reduced,
        symbol: 'circle',
        symbolSize: 12,
        itemStyle: { color: tokens.gold, borderColor: tokens.goldInk, borderWidth: 2 },
        label: {
          show: true,
          formatter: '1980 Moscow Boycott',
          position: nearStart ? 'right' : 'left',
          distance: 10,
          color: tokens.onMedal,
          fontFamily: tokens.fontText,
          fontWeight: 700,
          fontSize: fontSize(ctx),
          backgroundColor: tokens.goldContainer,
          borderColor: tokens.gold,
          borderWidth: 1,
          padding: [4, 8],
          borderRadius: 6,
        },
        tooltip: { formatter: '1980 Moscow Boycott: a US-led boycott kept many nations away from the Moscow Summer Games' },
        data: [{ coord: [1980, Math.max(p1980.male, p1980.female)] }],
      }
    : { data: [] };

  const option: EChartsCoreOption = {
    grid: { id: 'g', left: 8, right: 20, top: 48, bottom: 8, containLabel: true },
    legend: { id: 'lg', top: 0, left: 0, data: ['Male', 'Female'], icon: 'circle' },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params: unknown) => {
        const arr = params as { axisValue: number; dataIndex: number }[];
        if (!arr.length) return '';
        const p = pts.find((x) => x.year === Number(arr[0].axisValue)) ?? pts[arr[0].dataIndex];
        if (!p) return '';
        return head(String(p.year), p.label) +
          row(tokens.male, 'Male', fmtInt(p.male)) +
          row(tokens.female, 'Female', fmtInt(p.female)) +
          row(tokens.silver, 'Total', fmtInt(p.male + p.female)) +
          (p.year === 1980 ? `<div style="margin-top:6px;color:${tokens.goldInk};font-weight:600">1980 Moscow Boycott</div>` : '');
      },
    },
    xAxis: {
      id: 'x', type: 'value', min, max, minInterval: 2,
      axisLabel: { formatter: (v: number) => String(Math.round(v)), fontSize: fontSize(ctx), hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      id: 'y', type: 'value', name: 'Athlete entries', nameGap: 12,
      nameTextStyle: { align: 'left', fontSize: fontSize(ctx) },
      axisLabel: { formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v)), fontSize: fontSize(ctx) },
    },
    series: [
      {
        id: 'male', name: 'Male', type: 'line', color: tokens.male,
        data: pts.map((p) => [p.year, p.male]),
        symbolSize: ctx.width < 480 ? 5 : 7,
        emphasis: { ...NO_BLUR, scale: 1.4 },
        blur: BLUR_KEEP,
        lineStyle: { width: 3 },
        markLine,
        markPoint,
      },
      {
        id: 'female', name: 'Female', type: 'line', color: tokens.female,
        data: pts.map((p) => [p.year, p.female]),
        symbolSize: ctx.width < 480 ? 5 : 7,
        emphasis: { ...NO_BLUR, scale: 1.4 },
        blur: BLUR_KEEP,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.06 },
      },
    ],
  };
  return { option, insight, summary };
}

/* ------------------------------------------------------------------ */
/* 2. Top countries — Medals (stacked G/S/B, default) or Entries       */
/* ------------------------------------------------------------------ */
export function topCount(ctx: ChartCtx): number {
  return ctx.width < 480 ? 10 : 15;
}

export function topCountriesChart(s: Summary, mode: TopMode, ctx: ChartCtx): ChartResult {
  const n = topCount(ctx);
  const list: NocRow[] = (mode === 'medals' ? s.nocByMedals : s.nocByEntries).slice(0, n);
  if (!list.length) {
    if (s.empty) return emptyResult(s);
    return { option: null, insight: '', summary: 'No medals in this selection.', emptyTitle: 'No medals awarded', emptyText: 'No medal rows exist for this selection.' };
  }
  const leader = list[0];
  const insight = mode === 'medals'
    ? `${leader.name} (${leader.code}) leads with ${fmtInt(leader.total)} medals, ${fmtInt(leader.gold)} of them gold.`
    : `${leader.name} (${leader.code}) fielded the most athlete entries: ${fmtInt(leader.entries)}.`;
  const summary = (mode === 'medals'
    ? `Horizontal stacked bar chart of the top ${list.length} nations by medal rows (gold, silver, bronze). `
    : `Horizontal bar chart of the top ${list.length} nations by athlete-event entries. `) +
    list.map((r, i) => mode === 'medals'
      ? `${i + 1}. ${r.code} ${r.name}: ${fmtInt(r.total)} medals (${fmtInt(r.gold)} gold, ${fmtInt(r.silver)} silver, ${fmtInt(r.bronze)} bronze)`
      : `${i + 1}. ${r.code} ${r.name}: ${fmtInt(r.entries)} entries`).join('; ') + '.';

  const fs = fontSize(ctx);
  const badge = (bg: string) => ({
    backgroundColor: bg, color: tokens.onMedal, width: 20, height: 20, lineHeight: 20,
    borderRadius: 10, align: 'center' as const, fontWeight: 700 as const, fontSize: 11, fontFamily: tokens.fontText,
  });
  const yAxis = {
    id: 'y', type: 'category', inverse: true,
    data: list.map((r) => r.code),
    axisLine: { show: false },
    axisLabel: {
      interval: 0,
      margin: 10,
      formatter: (code: string, idx: number) =>
        idx < 3 ? `{r${idx + 1}|${idx + 1}}  {top|${code}}` : `{rn|${idx + 1}}  {code|${code}}`,
      rich: {
        r1: badge(tokens.gold), r2: badge(tokens.silver), r3: badge(tokens.bronze),
        rn: { color: tokens.onSurfaceVariant, width: 20, align: 'center', fontSize: 11, fontFamily: tokens.fontText },
        top: { color: tokens.onSurface, fontWeight: 700, fontSize: fs + 2, fontFamily: tokens.fontDisplay, width: 38 },
        code: { color: tokens.onSurfaceVariant, fontSize: fs, fontFamily: tokens.fontText, width: 38 },
      },
    },
  };
  // Ranks 4+ are visually secondary: lighter fills (not opacity, so their labels keep full contrast).
  const fill = (color: string, i: number) => (i < 3 ? color : lighten(color, 0.5));
  const totalLabel = (val: (r: NocRow) => number) => ({
    show: true,
    position: 'right',
    distance: 6,
    formatter: (p: { dataIndex: number }) => fmtInt(val(list[p.dataIndex])),
    color: tokens.onSurfaceVariant,
    fontSize: fs,
    fontFamily: tokens.fontText,
    rich: {},
  });

  const tooltip = {
    ...tooltipBase(),
    trigger: 'axis',
    axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(212, 175, 55, 0.07)' } },
    formatter: (params: unknown) => {
      const arr = params as { dataIndex: number }[];
      const r = list[arr[0]?.dataIndex ?? -1];
      if (!r) return '';
      const i = arr[0].dataIndex;
      const rankTxt = `#${i + 1} ${r.code}`;
      return head(rankTxt, r.name) +
        (mode === 'medals'
          ? row(tokens.gold, 'Gold', fmtInt(r.gold)) + row(tokens.silver, 'Silver', fmtInt(r.silver)) +
            row(tokens.bronze, 'Bronze', fmtInt(r.bronze)) + row('transparent', 'Total medals', fmtInt(r.total))
          : row(i < 3 ? MEDAL_COLORS[i] : tokens.outlineVariant, 'Athlete entries', fmtInt(r.entries)) +
            row('transparent', 'Medals', fmtInt(r.total)));
    },
  };

  const series = mode === 'medals'
    ? (['gold', 'silver', 'bronze'] as const).map((k, mi) => ({
        id: `m-${k}`, name: ['Gold', 'Silver', 'Bronze'][mi], type: 'bar', stack: 'medals',
        color: MEDAL_COLORS[mi],
        barMaxWidth: 26, barCategoryGap: '28%',
        data: list.map((r, i) => ({ value: r[k], itemStyle: { color: fill(MEDAL_COLORS[mi], i) } })),
        emphasis: ringEmphasis(),
        blur: BLUR_KEEP,
        itemStyle: mi === 2 ? { borderRadius: [0, 4, 4, 0] } : undefined,
        label: mi === 2 ? totalLabel((r) => r.total) : { show: false },
      }))
    : [{
        id: 'entries', name: 'Athlete entries', type: 'bar',
        barMaxWidth: 26, barCategoryGap: '28%',
        data: list.map((r, i) => ({
          value: r.entries,
          itemStyle: { color: i < 3 ? MEDAL_COLORS[i] : '#c9bba3', borderRadius: [0, 4, 4, 0] },
        })),
        emphasis: ringEmphasis(),
        blur: BLUR_KEEP,
        label: totalLabel((r) => r.entries),
      }];

  const option: EChartsCoreOption = {
    grid: { id: 'g', left: 4, right: 44, top: mode === 'medals' ? 36 : 12, bottom: 4, containLabel: true },
    legend: mode === 'medals'
      ? { id: 'lg', show: true, top: 0, left: 0, data: ['Gold', 'Silver', 'Bronze'], icon: 'circle' }
      : { id: 'lg', show: false, data: [] },
    tooltip,
    xAxis: {
      id: 'x', type: 'value',
      axisLabel: { fontSize: fs, formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v)), hideOverlap: true },
    },
    yAxis,
    series,
  };
  return { option, insight, summary, height: list.length * (ctx.width < 480 ? 34 : 30) + (mode === 'medals' ? 70 : 46) };
}

/* ------------------------------------------------------------------ */
/* 3. Height vs weight heatmap                                         */
/* ------------------------------------------------------------------ */
export function heightWeightChart(s: Summary, bins: HeatBins | null, loading: boolean, ctx: ChartCtx): ChartResult {
  if (s.empty) return emptyResult(s);
  const missingShare = s.rows ? 1 - s.hwRows / s.rows : 0;
  const note = s.rows && missingShare >= 0.005
    ? `Height/weight missing for ${fmtPct(s.rows - s.hwRows, s.rows)} of athlete entries in this selection (${fmtInt(s.hwRows)} of ${fmtInt(s.rows)} have both).`
    : undefined;
  if (loading) {
    return { option: null, insight: 'Loading body measurements…', summary: 'Loading.', emptyTitle: 'Loading…', emptyText: 'Fetching the height and weight grid.', note };
  }
  if (!bins) {
    return {
      option: null, insight: 'No height and weight recorded together for this selection.',
      summary: 'No athlete entries with both height and weight in this selection.',
      emptyTitle: 'No body measurements', emptyText: 'None of these entries has both height and weight recorded.', note,
    };
  }
  const { xStep, yStep, xStart, yStart } = bins;
  const range = (start: number, step: number, i: number) =>
    step === 1 ? `${start + i * step}` : `${start + i * step}–${start + (i + 1) * step - 1}`;
  const peak = bins.peak!;
  const peakTxt = (r: [number, number], unit: string) => (r[0] === r[1] ? `${r[0]} ${unit}` : `${r[0]}–${r[1]} ${unit}`);
  const insight = `Most common build: ${peakTxt(peak.h, 'cm')}, ${peakTxt(peak.w, 'kg')} (${fmtInt(peak.n)} entries).`;
  const summary = `Heatmap of ${fmtInt(bins.total)} athlete entries by height (${xStep} cm bins) and weight (${yStep} kg bins). ` +
    `Densest cell ${peakTxt(peak.h, 'cm')} and ${peakTxt(peak.w, 'kg')} with ${fmtInt(peak.n)} entries.` + (note ? ` ${note}` : '');
  const fs = fontSize(ctx);
  const option: EChartsCoreOption = {
    grid: { id: 'g', left: 8, right: 16, top: 28, bottom: 56, containLabel: true },
    tooltip: {
      ...tooltipBase(),
      trigger: 'item',
      formatter: (p: unknown) => {
        const d = (p as { data: [number, number, number] }).data;
        if (!d) return '';
        return head(`${range(xStart, xStep, d[0])} cm · ${range(yStart, yStep, d[1])} kg`) +
          row(tokens.gold, 'Athlete entries', fmtInt(d[2])) +
          `<div style="opacity:.8;font-size:12px">${fmtPct(d[2], bins.total, 1)} of measured entries</div>`;
      },
    },
    xAxis: {
      id: 'x', type: 'category', data: bins.xLabels.map((_, i) => String(xStart + i * xStep)),
      name: 'Height (cm)', nameLocation: 'middle', nameGap: 26,
      splitArea: { show: false },
      axisLabel: { fontSize: fs, hideOverlap: true },
      axisLine: { show: true, lineStyle: { color: tokens.outlineVariant } },
    },
    yAxis: {
      id: 'y', type: 'category', data: bins.yLabels.map((_, i) => String(yStart + i * yStep)),
      name: 'Weight (kg)', nameLocation: 'end', nameGap: 10,
      nameTextStyle: { align: 'left', fontSize: fs },
      axisLabel: { fontSize: fs, hideOverlap: true },
      splitArea: { show: false },
    },
    visualMap: {
      id: 'vm', type: 'continuous', min: 0, max: bins.max, calculable: false, realtime: false,
      orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: Math.min(220, ctx.width * 0.5),
      text: [fmtInt(bins.max), '0'], textGap: 8,
      textStyle: { color: tokens.onSurfaceVariant, fontSize: fs },
      inRange: { color: HEAT_SCALE },
      dimension: 2,
    },
    series: [{
      id: 'hw', name: 'Athlete entries', type: 'heatmap', data: bins.cells,
      itemStyle: { borderColor: tokens.surfaceContainerLowest, borderWidth: 1, borderRadius: 2 },
      emphasis: ringEmphasis(2),
      blur: BLUR_KEEP,
      progressive: 0,
    }],
  };
  return { option, insight, summary, note };
}

/* ------------------------------------------------------------------ */
/* 4. Medal winners by age — box plots                                 */
/* ------------------------------------------------------------------ */
export function medalAgeChart(s: Summary, ctx: ChartCtx): ChartResult {
  if (s.empty) return emptyResult(s);
  const cats = ['Medalist', 'Non-Medalist'];
  const anyData = s.boxes.some((pair) => pair.some(Boolean));
  if (!anyData) {
    return { option: null, insight: '', summary: 'No ages recorded.', emptyTitle: 'No ages recorded', emptyText: 'No entry in this selection has an age.' };
  }
  const fmtB = (b: BoxStats | null) => (b ? fmtFixed(b.median, b.median % 1 ? 1 : 0) : '—');
  const mm = s.boxes[0][0], mf = s.boxes[0][1];
  const insight = `Median medalist age: ${fmtB(mm)} for men, ${fmtB(mf)} for women.`;
  const summary = 'Box plots of age by medal status and sex. ' +
    cats.map((c, ci) => SEX.map((sx, si) => {
      const b = s.boxes[ci][si];
      return b ? `${c} ${sx}: median ${b.median}, quartiles ${b.q1}–${b.q3}, whiskers ${b.lower}–${b.upper}, n ${fmtInt(b.n)}` : `${c} ${sx}: no data`;
    }).join('; ')).join('; ') + '.';
  const fs = fontSize(ctx);
  const series = SEX.map((sx, si) => ({
    id: `box-${si}`, name: sx, type: 'boxplot',
    color: si === 0 ? tokens.male : tokens.female,
    boxWidth: [18, ctx.width < 480 ? 36 : 56],
    itemStyle: {
      color: si === 0 ? 'rgba(0,129,200,0.16)' : 'rgba(238,51,78,0.14)',
      borderColor: si === 0 ? tokens.male : tokens.female,
      borderWidth: 2,
    },
    emphasis: { ...NO_BLUR, itemStyle: { borderWidth: 2.5, shadowBlur: 0, shadowColor: 'transparent' } },
    blur: BLUR_KEEP,
    data: cats.map((_, ci) => {
      const b = s.boxes[ci][si];
      return b ? [b.lower, b.q1, b.median, b.q3, b.upper] : '-';
    }),
  }));
  const option: EChartsCoreOption = {
    grid: { id: 'g', left: 8, right: 16, top: 48, bottom: 8, containLabel: true },
    legend: { id: 'lg', top: 0, left: 0, data: [...SEX], icon: 'roundRect' },
    tooltip: {
      ...tooltipBase(),
      trigger: 'item',
      formatter: (p: unknown) => {
        const q = p as { seriesIndex: number; dataIndex: number };
        const b = s.boxes[q.dataIndex]?.[q.seriesIndex];
        if (!b) return '';
        const c = q.seriesIndex === 0 ? tokens.male : tokens.female;
        const f = (v: number) => fmtFixed(v, v % 1 ? 1 : 0);
        return head(`${cats[q.dataIndex]} · ${SEX[q.seriesIndex]}`, `${fmtInt(b.n)} entries with age`) +
          row(c, 'Upper whisker', f(b.upper)) + row(c, 'Q3', f(b.q3)) + row(c, 'Median', f(b.median)) +
          row(c, 'Q1', f(b.q1)) + row(c, 'Lower whisker', f(b.lower)) +
          `<div style="opacity:.8;font-size:12px;margin-top:4px">Range ${b.min}–${b.max} years</div>`;
      },
    },
    xAxis: { id: 'x', type: 'category', data: cats, axisLabel: { fontSize: fs + 1, fontWeight: 600, color: tokens.onSurface } },
    yAxis: { id: 'y', type: 'value', name: 'Age (years)', scale: true, nameTextStyle: { align: 'left', fontSize: fs }, axisLabel: { fontSize: fs } },
    series,
  };
  return { option, insight, summary };
}

/* ------------------------------------------------------------------ */
/* 5. Evolution of the Games — avg height, age, weight by sex          */
/* ------------------------------------------------------------------ */
const METRICS = [
  { key: 'h', title: 'Height', unit: 'cm', axis: 'Height (cm)' },
  { key: 'a', title: 'Age', unit: 'yrs', axis: 'Age (years)' },
  { key: 'w', title: 'Weight', unit: 'kg', axis: 'Weight (kg)' },
] as const;

export function evolutionChart(s: Summary, ctx: ChartCtx): ChartResult {
  const pts = s.evolution;
  if (!pts.length) return emptyResult(s);
  const years = pts.map((p) => p.year);
  const { min, max } = yearAxisRange(years);
  const wide = ctx.width >= 860;
  const fs = fontSize(ctx);
  const firstH = pts.find((p) => p.h[0] != null);
  const lastH = [...pts].reverse().find((p) => p.h[0] != null);
  const insight = firstH && lastH && firstH !== lastH
    ? `Average male height: ${fmtFixed(firstH.h[0], 1)} cm in ${firstH.year} → ${fmtFixed(lastH.h[0], 1)} cm in ${lastH.year}.`
    : firstH
      ? `Average male height ${fmtFixed(firstH.h[0], 1)} cm in ${firstH.year}.`
      : 'Average age by sex over time; body measurements are sparse in this range.';
  const summary = 'Three line charts of average height, age and weight per Games year by sex. ' +
    pts.map((p) => `${p.year}: height ${fmtFixed(p.h[0], 1)}/${fmtFixed(p.h[1], 1)} cm, age ${fmtFixed(p.a[0], 1)}/${fmtFixed(p.a[1], 1)}, weight ${fmtFixed(p.w[0], 1)}/${fmtFixed(p.w[1], 1)} kg (male/female)`).join('; ') + '.';

  const gap = 56;
  const grids = METRICS.map((_, i) => wide
    ? { id: `g${i}`, left: `${(i * 100) / 3 + (i === 0 ? 0.5 : 2.5)}%`, width: `${100 / 3 - 4}%`, top: 74, bottom: 8, containLabel: true }
    : { id: `g${i}`, left: 4, right: 12, top: 74 + i * (150 + gap), height: 150, containLabel: true });
  const titles = METRICS.map((m, i) => ({
    id: `t${i}`, text: `${m.title.toUpperCase()} (${m.unit})`,
    left: wide ? `${(i * 100) / 3 + (i === 0 ? 0.5 : 2.5)}%` : 4,
    top: wide ? 40 : 46 + i * (150 + gap),
    textStyle: { fontFamily: tokens.fontDisplay, fontSize: 14, fontWeight: 600, color: tokens.onSurface, letterSpacing: 1 } as Record<string, unknown>,
  }));
  const option: EChartsCoreOption = {
    title: titles,
    grid: grids,
    legend: { id: 'lg', top: 0, left: 0, data: [...SEX], icon: 'circle' },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      formatter: (params: unknown) => {
        const arr = params as { axisValue: number; axisIndex?: number }[];
        if (!arr.length) return '';
        const yr = Math.round(Number(arr[0].axisValue));
        const p = pts.find((x) => x.year === yr);
        if (!p) return '';
        const line = (m: (typeof METRICS)[number]) => {
          const v = p[m.key];
          return `<div style="margin-top:4px;opacity:.85;font-size:12px">${m.title}</div>` +
            row(tokens.male, 'Male', v[0] == null ? '—' : `${fmtFixed(v[0], 1)} ${m.unit}`) +
            row(tokens.female, 'Female', v[1] == null ? '—' : `${fmtFixed(v[1], 1)} ${m.unit}`);
        };
        return head(String(yr)) + METRICS.map(line).join('');
      },
    },
    xAxis: METRICS.map((_, i) => ({
      id: `x${i}`, gridIndex: i, type: 'value', min, max, minInterval: 2,
      axisLabel: { formatter: (v: number) => String(Math.round(v)), fontSize: fs, hideOverlap: true },
      splitLine: { show: false },
    })),
    yAxis: METRICS.map((_m, i) => ({
      id: `y${i}`, gridIndex: i, type: 'value', scale: true, splitNumber: 3,
      axisLabel: { fontSize: fs },
    })),
    series: METRICS.flatMap((m, i) => SEX.map((sx, si) => ({
      id: `${m.key}-${si}`, name: sx, type: 'line', xAxisIndex: i, yAxisIndex: i,
      color: si === 0 ? tokens.male : tokens.female,
      symbolSize: ctx.width < 480 ? 4 : 6,
      lineStyle: { width: 2.5 },
      emphasis: { ...NO_BLUR, scale: 1.4 },
      blur: BLUR_KEEP,
      connectNulls: true,
      data: pts.filter((p) => p[m.key][si] != null).map((p) => [p.year, Number(p[m.key][si]!.toFixed(2))]),
    }))),
  };
  const missH = s.rows ? 1 - s.heightPresent / s.rows : 0;
  const missW = s.rows ? 1 - s.weightPresent / s.rows : 0;
  const note = s.rows && (missH >= 0.005 || missW >= 0.005)
    ? `Averages use entries with a recorded value: height present for ${fmtPct(s.heightPresent, s.rows)}, weight for ${fmtPct(s.weightPresent, s.rows)} of entries in this selection.`
    : undefined;
  return { option, insight, summary, note, height: wide ? 340 : 74 + 3 * 150 + 2 * gap + 30 };
}

/* ------------------------------------------------------------------ */
/* 6. Age by sport — top 10 sports by entries with a recorded age       */
/* ------------------------------------------------------------------ */
export function sportAgeChart(s: Summary, ctx: ChartCtx): ChartResult {
  if (s.empty) return emptyResult(s);
  const rows = s.sportAge;
  if (!rows.length) {
    return { option: null, insight: '', summary: 'No ages recorded.', emptyTitle: 'No ages recorded', emptyText: 'No entry in this selection has an age.' };
  }
  const all = rows.flatMap((r) => r.mean.map((m, si) => ({ sport: r.sport, sex: SEX[si], m }))).filter((x) => x.m != null);
  const oldest = all.reduce((a, b) => (b.m! > a.m! ? b : a), all[0]);
  const youngest = all.reduce((a, b) => (b.m! < a.m! ? b : a), all[0]);
  const insight = all.length > 1
    ? `Oldest field: ${oldest.sport} (${oldest.sex.toLowerCase()}, ${fmtFixed(oldest.m, 1)}). Youngest: ${youngest.sport} (${youngest.sex.toLowerCase()}, ${fmtFixed(youngest.m, 1)}).`
    : `${rows[0].sport}: mean age ${fmtFixed(all[0]?.m ?? null, 1)}.`;
  const summary = `Grouped bar chart of mean age by sex for the top ${Math.min(10, rows.length)} sports by entries with a recorded age` +
    (rows.length > 10 ? `, plus ${rows.length - 10} sports new since 2016` : '') + '. ' +
    rows.map((r) => `${r.sport}${r.isNew ? ' (new since 2016)' : ''}: male ${fmtFixed(r.mean[0], 1)}, female ${fmtFixed(r.mean[1], 1)}`).join('; ') + '.';
  const horizontal = ctx.width < 720;
  const fs = fontSize(ctx);
  const cats = rows.map((r, i) => (i >= 10 && r.isNew ? `${r.sport} (new)` : r.sport));
  const catAxis = {
    id: horizontal ? 'cat-h' : 'cat-v', type: 'category', data: cats, inverse: horizontal,
    axisLabel: horizontal
      ? { fontSize: fs, interval: 0, width: ctx.width < 420 ? 92 : 130, overflow: 'break', color: tokens.onSurface }
      : { fontSize: fs, interval: 0, rotate: ctx.width < 1000 || cats.length > 10 ? 30 : 0, width: ctx.width < 1000 || cats.length > 10 ? 130 : 96, overflow: 'break', color: tokens.onSurface },
  };
  const valAxis = {
    id: horizontal ? 'val-h' : 'val-v', type: 'value', name: 'Mean age (years)', min: 0,
    nameLocation: horizontal ? 'middle' : 'end', nameGap: horizontal ? 26 : 12,
    nameTextStyle: { fontSize: fs, align: horizontal ? 'center' : 'left' },
    axisLabel: { fontSize: fs },
  };
  const option: EChartsCoreOption = {
    grid: { id: 'g', left: 4, right: horizontal ? 40 : 12, top: 44, bottom: horizontal ? 30 : 4, containLabel: true },
    legend: { id: 'lg', top: 0, left: 0, data: [...SEX], icon: 'circle' },
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(212, 175, 55, 0.07)' } },
      formatter: (params: unknown) => {
        const arr = params as { dataIndex: number }[];
        const r = rows[arr[0]?.dataIndex ?? -1];
        if (!r) return '';
        return head(r.sport, `${fmtInt(r.n)} entries with a recorded age${r.isNew ? ' · new since 2016' : ''}`) +
          row(tokens.male, `Male (${fmtInt(r.count[0])})`, r.mean[0] == null ? '—' : `${fmtFixed(r.mean[0], 1)} yrs`) +
          row(tokens.female, `Female (${fmtInt(r.count[1])})`, r.mean[1] == null ? '—' : `${fmtFixed(r.mean[1], 1)} yrs`);
      },
    },
    xAxis: horizontal ? valAxis : catAxis,
    yAxis: horizontal ? catAxis : valAxis,
    series: SEX.map((sx, si) => ({
      id: `sa-${si}`, name: sx, type: 'bar',
      color: si === 0 ? tokens.male : tokens.female,
      barMaxWidth: 22, barGap: '12%', barCategoryGap: '30%',
      itemStyle: { borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0] },
      emphasis: ringEmphasis(),
      blur: BLUR_KEEP,
      label: {
        show: true, position: horizontal ? 'right' : 'top', distance: 3,
        formatter: (p: { value: number | string }) => (typeof p.value === 'number' ? p.value.toFixed(1) : ''),
        fontSize: ctx.width < 480 ? 11 : 11, color: si === 0 ? tokens.maleInk : tokens.femaleInk, fontWeight: 600,
      },
      data: rows.map((r) => (r.mean[si] == null ? '-' : Number(r.mean[si]!.toFixed(4)))),
    })),
  };
  const series0 = (option.series as Record<string, unknown>[])[0];
  if (rows.length > 10 && !horizontal) {
    // Shade the appended "new since 2016" sports so they read as a separate group.
    const a = cats[10], b = cats[cats.length - 1];
    series0.markArea = {
      silent: true,
      itemStyle: { color: 'rgba(212, 175, 55, 0.10)', borderColor: tokens.gold, borderWidth: 1, borderType: 'dashed' },
      label: { show: true, formatter: 'New since 2016', position: horizontal ? 'insideBottomRight' : 'insideTop', color: tokens.goldInk, fontWeight: 700, fontSize: 11 },
      data: [horizontal ? [{ yAxis: a }, { yAxis: b }] : [{ xAxis: a }, { xAxis: b }]],
    };
  } else {
    series0.markArea = { data: [] };
  }
  return { option, insight, summary, height: horizontal ? rows.length * 46 + 90 : 400 };
}

/* ------------------------------------------------------------------ */
export function emptyResult(s: Summary): ChartResult {
  return {
    option: null,
    insight: 'No Games match this selection.',
    summary: 'No data for this selection.',
    emptyTitle: 'No Games in this selection',
    emptyText: emptyHint(s),
  };
}

export function emptyHint(s: Summary): string {
  const { start, end, season } = s.filter;
  if (season === 'Winter' && end < 1924) return 'The first Winter Games were held in 1924 in Chamonix. Widen the year range or switch the season.';
  if (season === 'Summer' && start >= 2026) return 'Milano-Cortina 2026 was a Winter Games; the next Summer Games are LA 2028. Try Winter or All.';
  if (season === 'Summer' && start === end && [1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022].includes(start)) return `${start} had only Winter Games. Try Winter or All.`;
  if (season === 'Winter' && start === end && start >= 1994 && start % 4 === 0) return `${start} had only Summer Games. Try Summer or All.`;
  if (start === end && [1916, 1940, 1944].includes(start)) return `The ${start} Games were cancelled because of world war. Pick another year.`;
  if (start === end && start === 1906) return 'Only the 1906 Intercalated Games (Summer) took place that year.';
  return 'No Olympic Games took place for this year range and season. Widen the range or switch the season.';
}

export function baseOption(reduced: boolean): EChartsCoreOption {
  return {
    animation: !reduced,
    animationDuration: reduced ? 0 : tokens.durationEnter,
    animationDurationUpdate: reduced ? 0 : tokens.durationUpdate,
    animationEasing: 'cubicOut',
    animationEasingUpdate: emphasizedEasing,
    textStyle: { fontFamily: tokens.fontText },
  };
}

export { echarts };
