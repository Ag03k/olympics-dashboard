/**
 * Data loading and exact client-side aggregation.
 *
 * The build script (scripts/build_data.py) ships additive per-Games aggregates
 * (sums and counts). Every number shown is recomputed here from those sums for
 * the selected Games, so results equal a pandas computation over the raw rows.
 */

export type Season = 'All' | 'Summer' | 'Winter';

export interface GameRec {
  year: number;
  season: 'Summer' | 'Winter';
  city: string;
  rows: [number, number]; // Male, Female
  medals: [number, number, number]; // Gold, Silver, Bronze rows
  sports: number[];
  h: [number, number, number, number]; // sumMale, nMale, sumFemale, nFemale
  w: [number, number, number, number];
  a: [number, number, number, number];
  hwRows: number;
  noc: number[]; // flat [nocIndex, entries, gold, silver, bronze]
  age: number[]; // flat [age, nonMedalM, nonMedalF, medalM, medalF]
  sportAge: number[]; // flat [sportIndex, sex, n, sumAge]
}

export interface CoreData {
  version: number;
  sexes: string[];
  sports: string[];
  nocs: string[];
  nocNames: string[];
  games: GameRec[];
  athletes: number[][]; // [count, ...gameIndices]
}

export interface HwData {
  version: number;
  games: number[][]; // flat [height, weight, rows]
}

export interface Filter {
  start: number;
  end: number;
  season: Season;
}

export interface NocRow {
  code: string;
  name: string;
  entries: number;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

export interface BoxStats {
  n: number;
  min: number;
  max: number;
  q1: number;
  median: number;
  q3: number;
  lower: number; // lower whisker (Tukey, 1.5 IQR, within data)
  upper: number; // upper whisker
}

export interface YearPoint {
  year: number;
  label: string; // host cities for tooltip
  male: number;
  female: number;
}

export interface EvoPoint {
  year: number;
  h: [number | null, number | null];
  a: [number | null, number | null];
  w: [number | null, number | null];
}

export interface SportAgeRow {
  sport: string;
  n: number;
  mean: [number | null, number | null];
  count: [number, number];
  /** Sport debuted after 2016 (appended after the top 10 so new Games stay visible). */
  isNew: boolean;
}

export interface Summary {
  filter: Filter;
  gameIdx: number[];
  empty: boolean;
  games: number;
  rows: number;
  rowsBySex: [number, number];
  athletes: number;
  medals: number;
  sports: number;
  avgHeight: number | null;
  avgWeight: number | null;
  avgAge: number | null;
  heightPresent: number;
  weightPresent: number;
  hwRows: number;
  participation: YearPoint[];
  evolution: EvoPoint[];
  nocByMedals: NocRow[];
  nocByEntries: NocRow[];
  /** boxes[status][sex]; status 0 = Medalist, 1 = Non-Medalist */
  boxes: [[BoxStats | null, BoxStats | null], [BoxStats | null, BoxStats | null]];
  sportAge: SportAgeRow[];
  gamesList: { year: number; season: string; city: string }[];
}

export async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return (await res.json()) as T;
}

export function selectGames(core: CoreData, f: Filter): number[] {
  const out: number[] = [];
  core.games.forEach((g, i) => {
    if (g.year >= f.start && g.year <= f.end && (f.season === 'All' || g.season === f.season)) out.push(i);
  });
  return out;
}

const mean = (sum: number, n: number): number | null => (n > 0 ? sum / n : null);

/** Linear-interpolated quantile (numpy default / plotly "linear") from a sorted histogram. */
function histQuantile(values: number[], counts: number[], n: number, p: number): number {
  const pos = p * (n - 1);
  const lo = Math.floor(pos);
  const frac = pos - lo;
  const at = (k: number): number => {
    let c = 0;
    for (let i = 0; i < values.length; i++) {
      c += counts[i];
      if (k < c) return values[i];
    }
    return values[values.length - 1];
  };
  const a = at(lo);
  if (frac === 0) return a;
  const b = at(lo + 1);
  return a + frac * (b - a);
}

export function boxFromHist(hist: Map<number, number>): BoxStats | null {
  const values = [...hist.keys()].filter((v) => (hist.get(v) ?? 0) > 0).sort((x, y) => x - y);
  if (!values.length) return null;
  const counts = values.map((v) => hist.get(v) ?? 0);
  const n = counts.reduce((s, c) => s + c, 0);
  const q1 = histQuantile(values, counts, n, 0.25);
  const median = histQuantile(values, counts, n, 0.5);
  const q3 = histQuantile(values, counts, n, 0.75);
  const iqr = q3 - q1;
  const loF = q1 - 1.5 * iqr;
  const hiF = q3 + 1.5 * iqr;
  const lower = values.find((v) => v >= loF) ?? values[0];
  let upper = values[values.length - 1];
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] <= hiF) {
      upper = values[i];
      break;
    }
  }
  return { n, min: values[0], max: values[values.length - 1], q1, median, q3, lower, upper };
}

/** Sports first held after this year are flagged as new (2018–2026 additions). */
export const NEW_SPORT_AFTER = 2016;
let debutCache: Map<number, number> | null = null;
function sportDebuts(core: CoreData): Map<number, number> {
  if (debutCache) return debutCache;
  const m = new Map<number, number>();
  for (const g of core.games) for (const si of g.sports) if (!m.has(si) || g.year < m.get(si)!) m.set(si, g.year);
  debutCache = m;
  return m;
}

export function summarize(core: CoreData, filter: Filter): Summary {
  const gameIdx = selectGames(core, filter);
  const games = gameIdx.map((i) => core.games[i]);

  const rowsBySex: [number, number] = [0, 0];
  let medals = 0;
  const sportSet = new Set<number>();
  const sums = { h: [0, 0, 0, 0], w: [0, 0, 0, 0], a: [0, 0, 0, 0] };
  let hwRows = 0;

  const byYear = new Map<number, { male: number; female: number; cities: string[]; h: number[]; w: number[]; a: number[] }>();
  const nocAgg = new Map<number, [number, number, number, number]>();
  const ageHist: Map<number, number>[] = [new Map(), new Map(), new Map(), new Map()]; // nonM, nonF, medM, medF
  const sportAgg = new Map<number, [number, number, number, number]>(); // nM, sumM, nF, sumF

  for (const g of games) {
    rowsBySex[0] += g.rows[0];
    rowsBySex[1] += g.rows[1];
    medals += g.medals[0] + g.medals[1] + g.medals[2];
    g.sports.forEach((s) => sportSet.add(s));
    for (const k of ['h', 'w', 'a'] as const) for (let j = 0; j < 4; j++) sums[k][j] += g[k][j];
    hwRows += g.hwRows;

    let y = byYear.get(g.year);
    if (!y) {
      y = { male: 0, female: 0, cities: [], h: [0, 0, 0, 0], w: [0, 0, 0, 0], a: [0, 0, 0, 0] };
      byYear.set(g.year, y);
    }
    y.male += g.rows[0];
    y.female += g.rows[1];
    y.cities.push(`${g.city} (${g.season})`);
    for (const k of ['h', 'w', 'a'] as const) for (let j = 0; j < 4; j++) y[k][j] += g[k][j];

    for (let i = 0; i < g.noc.length; i += 5) {
      const ni = g.noc[i];
      let r = nocAgg.get(ni);
      if (!r) {
        r = [0, 0, 0, 0];
        nocAgg.set(ni, r);
      }
      r[0] += g.noc[i + 1];
      r[1] += g.noc[i + 2];
      r[2] += g.noc[i + 3];
      r[3] += g.noc[i + 4];
    }
    for (let i = 0; i < g.age.length; i += 5) {
      const age = g.age[i];
      for (let j = 0; j < 4; j++) {
        const c = g.age[i + 1 + j];
        if (c) ageHist[j].set(age, (ageHist[j].get(age) ?? 0) + c);
      }
    }
    for (let i = 0; i < g.sportAge.length; i += 4) {
      const si = g.sportAge[i];
      const sex = g.sportAge[i + 1];
      let r = sportAgg.get(si);
      if (!r) {
        r = [0, 0, 0, 0];
        sportAgg.set(si, r);
      }
      r[sex * 2] += g.sportAge[i + 2];
      r[sex * 2 + 1] += g.sportAge[i + 3];
    }
  }

  // Unique athletes: patterns are [count, ...gameIndices]
  const selected = new Uint8Array(core.games.length);
  gameIdx.forEach((i) => (selected[i] = 1));
  let athletes = 0;
  for (const p of core.athletes) {
    for (let k = 1; k < p.length; k++) {
      if (selected[p[k]]) {
        athletes += p[0];
        break;
      }
    }
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const participation: YearPoint[] = years.map((yr) => {
    const y = byYear.get(yr)!;
    return { year: yr, label: y.cities.join(' · '), male: y.male, female: y.female };
  });
  const evolution: EvoPoint[] = years.map((yr) => {
    const y = byYear.get(yr)!;
    return {
      year: yr,
      h: [mean(y.h[0], y.h[1]), mean(y.h[2], y.h[3])],
      a: [mean(y.a[0], y.a[1]), mean(y.a[2], y.a[3])],
      w: [mean(y.w[0], y.w[1]), mean(y.w[2], y.w[3])],
    };
  });

  const nocRows: NocRow[] = [...nocAgg.entries()].map(([ni, r]) => ({
    code: core.nocs[ni],
    name: core.nocNames[ni],
    entries: r[0],
    gold: r[1],
    silver: r[2],
    bronze: r[3],
    total: r[1] + r[2] + r[3],
  }));
  const nocByMedals = nocRows
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.code.localeCompare(b.code));
  const nocByEntries = [...nocRows].sort((a, b) => b.entries - a.entries || a.code.localeCompare(b.code));

  const boxes: Summary['boxes'] = [
    [boxFromHist(ageHist[2]), boxFromHist(ageHist[3])],
    [boxFromHist(ageHist[0]), boxFromHist(ageHist[1])],
  ];

  const debut = sportDebuts(core);
  const allSports: SportAgeRow[] = [...sportAgg.entries()]
    .map(([si, r]) => ({
      sport: core.sports[si],
      n: r[0] + r[2],
      mean: [mean(r[1], r[0]), mean(r[3], r[2])] as [number | null, number | null],
      count: [r[0], r[2]] as [number, number],
      isNew: (debut.get(si) ?? 0) > NEW_SPORT_AFTER,
    }))
    .sort((a, b) => b.n - a.n || a.sport.localeCompare(b.sport));
  const top10 = allSports.slice(0, 10);
  const sportAge = [...top10, ...allSports.slice(10).filter((r) => r.isNew)];

  const rows = rowsBySex[0] + rowsBySex[1];
  return {
    filter,
    gameIdx,
    empty: rows === 0,
    games: games.length,
    rows,
    rowsBySex,
    athletes,
    medals,
    sports: sportSet.size,
    avgHeight: mean(sums.h[0] + sums.h[2], sums.h[1] + sums.h[3]),
    avgWeight: mean(sums.w[0] + sums.w[2], sums.w[1] + sums.w[3]),
    avgAge: mean(sums.a[0] + sums.a[2], sums.a[1] + sums.a[3]),
    heightPresent: sums.h[1] + sums.h[3],
    weightPresent: sums.w[1] + sums.w[3],
    hwRows,
    participation,
    evolution,
    nocByMedals,
    nocByEntries,
    boxes,
    sportAge,
    gamesList: games.map((g) => ({ year: g.year, season: g.season, city: g.city })),
  };
}

export interface HeatBins {
  xLabels: string[]; // height bin labels
  yLabels: string[]; // weight bin labels
  xStart: number;
  xStep: number;
  yStart: number;
  yStep: number;
  cells: [number, number, number][]; // [xIndex, yIndex, rows]
  max: number;
  total: number;
  peak: { h: [number, number]; w: [number, number]; n: number } | null;
}

const NICE_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
function niceStep(range: number, bins: number): number {
  const raw = range / bins;
  return NICE_STEPS.find((s) => s >= raw) ?? Math.ceil(raw);
}

/** Re-bin the integer height × weight grid for the selected Games into ~targetBins per axis. */
export function heatBins(hw: HwData, gameIdx: number[], targetBins = 25): HeatBins | null {
  const grid = new Map<number, number>(); // key h*1000+w
  let hMin = Infinity, hMax = -Infinity, wMin = Infinity, wMax = -Infinity, total = 0;
  for (const gi of gameIdx) {
    const flat = hw.games[gi] ?? [];
    for (let i = 0; i < flat.length; i += 3) {
      const h = flat[i], w = flat[i + 1], n = flat[i + 2];
      grid.set(h * 1000 + w, (grid.get(h * 1000 + w) ?? 0) + n);
      total += n;
      if (h < hMin) hMin = h;
      if (h > hMax) hMax = h;
      if (w < wMin) wMin = w;
      if (w > wMax) wMax = w;
    }
  }
  if (!total) return null;
  const xStep = niceStep(hMax - hMin + 1, targetBins);
  const yStep = niceStep(wMax - wMin + 1, targetBins);
  const xStart = Math.floor(hMin / xStep) * xStep;
  const yStart = Math.floor(wMin / yStep) * yStep;
  const nx = Math.floor((hMax - xStart) / xStep) + 1;
  const ny = Math.floor((wMax - yStart) / yStep) + 1;
  const counts = new Map<number, number>();
  grid.forEach((n, key) => {
    const h = Math.floor(key / 1000), w = key % 1000;
    const xi = Math.floor((h - xStart) / xStep), yi = Math.floor((w - yStart) / yStep);
    const k = xi * 1000 + yi;
    counts.set(k, (counts.get(k) ?? 0) + n);
  });
  const cells: [number, number, number][] = [];
  let max = 0;
  let peakKey = -1;
  counts.forEach((n, k) => {
    cells.push([Math.floor(k / 1000), k % 1000, n]);
    if (n > max) {
      max = n;
      peakKey = k;
    }
  });
  const label = (start: number, step: number, i: number) =>
    step === 1 ? `${start + i * step}` : `${start + i * step}–${start + (i + 1) * step - 1}`;
  const xLabels = Array.from({ length: nx }, (_, i) => label(xStart, xStep, i));
  const yLabels = Array.from({ length: ny }, (_, i) => label(yStart, yStep, i));
  const px = Math.floor(peakKey / 1000), py = peakKey % 1000;
  return {
    xLabels,
    yLabels,
    xStart,
    xStep,
    yStart,
    yStep,
    cells,
    max,
    total,
    peak: peakKey >= 0
      ? { h: [xStart + px * xStep, xStart + (px + 1) * xStep - 1], w: [yStart + py * yStep, yStart + (py + 1) * yStep - 1], n: max }
      : null,
  };
}
