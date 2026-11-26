import './styles/tokens.css';
import './styles/app.css';
import './styles/hero.css';

import '@material/web/tabs/tabs.js';
import '@material/web/tabs/primary-tab.js';
import '@material/web/slider/slider.js';
import '@material/web/chips/chip-set.js';
import '@material/web/chips/filter-chip.js';
import '@material/web/icon/icon.js';
import '@material/web/elevation/elevation.js';
import '@material/web/ripple/ripple.js';

import type { MdTabs } from '@material/web/tabs/tabs.js';
import type { MdSlider } from '@material/web/slider/slider.js';
import type { MdFilterChip } from '@material/web/chips/filter-chip.js';

import { hydrateIcons } from './icons';
import { loadJson, summarize, heatBins } from './data';
import type { CoreData, HwData, Filter, Season, Summary, HeatBins } from './data';
import {
  echarts, baseOption, participationChart, topCountriesChart, heightWeightChart, medalAgeChart,
  evolutionChart, sportAgeChart, emptyHint,
} from './charts';
import type { ChartCtx, ChartResult, TopMode } from './charts';
import { fmtInt, fmtFixed, escapeHtml, EMPTY } from './format';
import { countUp, debounce, reducedMotion, onReducedMotionChange } from './motion';
import { startHero } from './intro/boot';

hydrateIcons();

// Start the core data download immediately; the opening intro (lazy-loaded) reads the Games list from it
// while the dashboard boots in parallel.
const corePromise = loadJson<CoreData>('/data/core.json');
startHero(corePromise.then((c) => c.games));

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
const state: { filter: Filter; topMode: TopMode; core?: CoreData; hw?: HwData; hwFailed: boolean; summary?: Summary; bins?: HeatBins | null } = {
  filter: { start: 1980, end: 2026, season: 'All' },
  topMode: 'medals',
  hwFailed: false,
};

/* ------------------------------------------------------------------ */
/* Chart hosts                                                         */
/* ------------------------------------------------------------------ */
type ChartKey = 'participation' | 'top' | 'hw' | 'age' | 'evolution' | 'sport';

class ChartHost {
  readonly card: HTMLElement;
  readonly el: HTMLElement;
  private readonly emptyEl: HTMLElement;
  private readonly noteEl: HTMLElement;
  private readonly insightEl: HTMLElement;
  private readonly summaryEl: HTMLElement;
  private chart: echarts.ECharts | null = null;
  private lastWidthClass = '';
  private lastHeight = 0;
  constructor(id: string, private readonly build: (ctx: ChartCtx) => ChartResult | null) {
    this.card = document.getElementById(id)!;
    this.el = this.card.querySelector<HTMLElement>('.chart')!;
    this.emptyEl = this.card.querySelector<HTMLElement>('.empty')!;
    this.noteEl = this.card.querySelector<HTMLElement>('.chart-card__note:not([data-static-note])') ?? document.createElement('p');
    this.insightEl = this.card.querySelector<HTMLElement>('[data-insight]')!;
    this.summaryEl = this.card.querySelector<HTMLElement>('[data-summary]')!;
    const ro = new ResizeObserver(() => this.onResize());
    ro.observe(this.el.parentElement!);
  }

  private ctx(): ChartCtx {
    return { width: this.el.parentElement!.clientWidth || this.card.clientWidth || 360, reduced: reducedMotion() };
  }

  private widthClass(w: number): string {
    return w < 420 ? 'xs' : w < 480 ? 's' : w < 720 ? 'm' : w < 860 ? 'l' : w < 1000 ? 'xl' : 'xxl';
  }

  private lastSize = '';
  private onResize(): void {
    const w = this.el.parentElement!.clientWidth;
    if (!w) return;
    const size = `${w}x${this.el.clientHeight}`;
    if (size === this.lastSize) return;
    this.lastSize = size;
    const cls = this.widthClass(w);
    if (cls !== this.lastWidthClass && this.lastWidthClass) {
      this.render();
      return;
    }
    this.chart?.resize();
  }

  render(): void {
    const ctx = this.ctx();
    if (!this.el.parentElement!.clientWidth) return; // hidden tab; re-rendered on show
    this.lastWidthClass = this.widthClass(ctx.width);
    const res = this.build(ctx);
    if (!res) return;
    this.insightEl.textContent = res.insight || this.insightEl.textContent;
    this.summaryEl.textContent = res.summary;
    if (res.note) {
      this.noteEl.textContent = res.note;
      this.noteEl.hidden = false;
    } else {
      this.noteEl.hidden = true;
    }
    if (!res.option) {
      this.card.classList.add('is-empty');
      this.emptyEl.hidden = false;
      this.emptyEl.innerHTML = `<div class="empty__icon"><i data-icon="event_busy"></i></div>
        <p class="empty__title">${escapeHtml(res.emptyTitle ?? 'Nothing to show')}</p>
        <p class="empty__text">${escapeHtml(res.emptyText ?? '')}</p>`;
      hydrateIcons(this.emptyEl);
      this.el.setAttribute('aria-hidden', 'true');
      return;
    }
    this.card.classList.remove('is-empty');
    this.emptyEl.hidden = true;
    this.el.removeAttribute('aria-hidden');
    const h = res.height ?? 0;
    if (h && h !== this.lastHeight) {
      this.el.style.height = `${h}px`;
      this.lastHeight = h;
    }
    if (!this.chart) {
      this.chart = echarts.init(this.el, 'olympians', { renderer: 'canvas' });
    } else if (h) {
      this.chart.resize();
    }
    this.chart.setOption({ ...baseOption(ctx.reduced), ...res.option }, { replaceMerge: ['series', 'xAxis', 'yAxis', 'grid', 'title', 'visualMap', 'legend'] });
  }
}

const hosts: Record<ChartKey, ChartHost> = {
  participation: new ChartHost('card-participation', (ctx) => (state.summary ? participationChart(state.summary, ctx) : null)),
  top: new ChartHost('card-top', (ctx) => (state.summary ? topCountriesChart(state.summary, state.topMode, ctx) : null)),
  hw: new ChartHost('card-hw', (ctx) =>
    state.summary ? heightWeightChart(state.summary, state.bins ?? null, !state.hw && !state.hwFailed, ctx) : null),
  age: new ChartHost('card-age', (ctx) => (state.summary ? medalAgeChart(state.summary, ctx) : null)),
  evolution: new ChartHost('card-evolution', (ctx) => (state.summary ? evolutionChart(state.summary, ctx) : null)),
  sport: new ChartHost('card-sport', (ctx) => (state.summary ? sportAgeChart(state.summary, ctx) : null)),
};

/* ------------------------------------------------------------------ */
/* Stats, hero strip, podium                                           */
/* ------------------------------------------------------------------ */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const intF = (v: number | null) => fmtInt(v);
const f1 = (v: number | null) => fmtFixed(v, 1);
const f0 = (v: number | null) => fmtFixed(v, 0);

function seasonText(s: Season): string {
  return s === 'All' ? 'Summer & Winter Games' : `${s} Games`;
}

function rangeText(f: Filter): string {
  return f.start === f.end ? String(f.start) : `${f.start} – ${f.end}`;
}

function renderStats(s: Summary): void {
  const empty = s.empty;
  countUp($('hero-games'), empty ? null : s.games, intF, 700);
  countUp($('hero-athletes'), empty ? null : s.athletes, intF);
  countUp($('hero-entries'), empty ? null : s.rows, intF);
  countUp($('hero-medals'), empty ? null : s.medals, intF);
  $('hero-scope').textContent = empty
    ? `No Games for ${rangeText(s.filter)} · ${seasonText(s.filter.season)}`
    : `Showing ${rangeText(s.filter)} · ${seasonText(s.filter.season)}`;

  countUp($('stat-sports'), empty ? null : s.sports, intF, 700);
  countUp($('stat-height'), s.avgHeight, f1);
  countUp($('stat-weight'), s.avgWeight, f1);
  countUp($('stat-age'), s.avgAge, f0, 700);
  const of = (n: number) => (s.rows ? `${fmtInt(n)} of ${fmtInt(s.rows)} entries` : 'no entries');
  $('stat-sports-foot').textContent = empty ? 'no Games in range' : `across ${fmtInt(s.games)} Games`;
  $('stat-height-foot').textContent = empty ? 'no entries' : s.avgHeight == null ? 'no heights recorded' : `from ${of(s.heightPresent)}`;
  $('stat-weight-foot').textContent = empty ? 'no entries' : s.avgWeight == null ? 'no weights recorded' : `from ${of(s.weightPresent)}`;
  const agePresent = s.boxes.flat().reduce((t, b) => t + (b?.n ?? 0), 0);
  $('stat-age-foot').textContent = empty ? 'no entries' : s.avgAge == null ? 'no ages recorded' : `from ${of(agePresent)}`;

  $('live-status').textContent = empty
    ? `No Games for ${rangeText(s.filter)}, ${seasonText(s.filter.season)}.`
    : `Showing ${rangeText(s.filter)}, ${seasonText(s.filter.season)}: ${fmtInt(s.games)} Games, ${fmtInt(s.rows)} entries.`;
}

function renderPodium(s: Summary): void {
  const top = s.nocByMedals.slice(0, 3);
  const stage = $('podium-stage');
  const emptyEl = $('podium-empty');
  $('podium-scope').textContent = s.empty ? '' : `${rangeText(s.filter)} · ${s.filter.season === 'All' ? 'All Games' : s.filter.season}`;
  if (!top.length) {
    stage.classList.add('is-empty');
    emptyEl.hidden = false;
    emptyEl.textContent = s.empty ? emptyHint(s) : 'No medals awarded in this selection.';
  } else {
    stage.classList.remove('is-empty');
    emptyEl.hidden = true;
  }
  const names = ['Gold', 'Silver', 'Bronze'];
  stage.querySelectorAll<HTMLElement>('.step').forEach((li) => {
    const rank = Number(li.dataset.rank);
    const r = top[rank - 1];
    const label = r
      ? `${names[rank - 1]} position, rank ${rank}: ${r.name} (${r.code}), ${fmtInt(r.total)} medals: ${fmtInt(r.gold)} gold, ${fmtInt(r.silver)} silver, ${fmtInt(r.bronze)} bronze`
      : `Rank ${rank}: no nation`;
    li.setAttribute('aria-label', label);
    li.innerHTML = `
      <div class="step__nation" aria-hidden="true">
        <span class="step__medal"><span>${rank}</span></span>
        <span class="step__code">${r ? escapeHtml(r.code) : EMPTY}</span>
        <span class="step__name">${r ? escapeHtml(r.name) : '&nbsp;'}</span>
        <span class="step__total">${r ? `<b>${fmtInt(r.total)}</b> medals` : '&nbsp;'}</span>
        <span class="step__split">${r
          ? `<span class="pip pip--g" title="Gold">${fmtInt(r.gold)}</span><span class="pip pip--s" title="Silver">${fmtInt(r.silver)}</span><span class="pip pip--b" title="Bronze">${fmtInt(r.bronze)}</span>`
          : ''}</span>
      </div>
      <div class="step__block" aria-hidden="true"><span>${rank}</span></div>`;
  });
  // Rise animation: restart on every change
  if (!reducedMotion()) {
    stage.classList.remove('rise');
    void stage.offsetWidth;
    stage.classList.add('rise');
  }
}

/* ------------------------------------------------------------------ */
/* Update pipeline                                                     */
/* ------------------------------------------------------------------ */
function computeBins(): void {
  if (!state.summary || !state.hw) {
    state.bins = null;
    return;
  }
  state.bins = state.summary.empty ? null : heatBins(state.hw, state.summary.gameIdx, 25);
}

function update(): void {
  if (!state.core) return;
  state.summary = summarize(state.core, state.filter);
  rangeOut.textContent = rangeText(state.filter);
  computeBins();
  renderStats(state.summary);
  renderPodium(state.summary);
  (Object.keys(hosts) as ChartKey[]).forEach((k) => hosts[k].render());
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */
const slider = $<MdSlider>('year-slider');
// Set via properties (not host attributes) so the host carries no non-standard aria-* attributes.
slider.ariaLabelStart = 'Start year';
slider.ariaLabelEnd = 'End year';
const rangeOut = $('range-text');

function readSlider(): { start: number; end: number } {
  const a = slider.valueStart ?? 1980;
  const b = slider.valueEnd ?? 2026;
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

const debouncedUpdate = debounce(() => update(), 140);
slider.addEventListener('input', () => {
  const { start, end } = readSlider();
  rangeOut.textContent = rangeText({ start, end, season: state.filter.season });
  if (start === state.filter.start && end === state.filter.end) return;
  state.filter = { ...state.filter, start, end };
  debouncedUpdate();
});
slider.addEventListener('change', () => {
  const { start, end } = readSlider();
  if (start === state.filter.start && end === state.filter.end) return;
  state.filter = { ...state.filter, start, end };
  update();
});

function singleSelect(set: HTMLElement, attr: string, onPick: (value: string) => void): void {
  const chips = [...set.querySelectorAll<MdFilterChip>('md-filter-chip')];
  chips.forEach((chip) => {
    chip.addEventListener('click', (e) => {
      // md-filter-chip has already toggled `selected`; keep exactly one selected.
      if (!chip.selected) {
        e.preventDefault(); // reverts the toggle-off
        return;
      }
      chips.forEach((c) => {
        if (c !== chip) c.selected = false;
      });
      onPick(chip.dataset[attr] ?? '');
    });
  });
}

singleSelect($('season-chips'), 'season', (v) => {
  state.filter = { ...state.filter, season: v as Season };
  update();
});
singleSelect($('top-mode'), 'mode', (v) => {
  state.topMode = v as TopMode;
  const t = $('t-top');
  t.textContent = state.topMode === 'medals' ? 'Top countries' : 'Top countries by entries';
  hosts.top.render();
});

/* ------------------------------------------------------------------ */
/* Tabs with view transitions                                          */
/* ------------------------------------------------------------------ */
const tabs = $<MdTabs>('tabs');
const panels = [$('panel-overview'), $('panel-about')];

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

function showPanel(index: number, focus = false): void {
  const apply = () => {
    panels.forEach((p, i) => (p.hidden = i !== index));
    document.documentElement.dataset.tab = index === 0 ? 'overview' : 'about';
    if (index === 0) requestAnimationFrame(() => (Object.keys(hosts) as ChartKey[]).forEach((k) => hosts[k].render()));
    if (focus) panels[index].focus({ preventScroll: true });
  };
  const doc = document as DocWithVT;
  const current = panels.findIndex((p) => !p.hidden);
  if (current === index) return;
  document.documentElement.dataset.dir = index > current ? 'fwd' : 'back';
  if (doc.startViewTransition && !reducedMotion()) {
    doc.startViewTransition(apply);
  } else {
    apply();
    if (!reducedMotion()) {
      panels[index].classList.remove('panel-enter');
      void panels[index].offsetWidth;
      panels[index].classList.add('panel-enter');
    }
  }
  const appbar = document.querySelector<HTMLElement>('.appbar')!;
  const top = appbar.getBoundingClientRect().top + window.scrollY;
  if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
}

tabs.addEventListener('change', () => showPanel(tabs.activeTabIndex));
panels.forEach((p) => p.setAttribute('tabindex', '-1'));

$('footer-credits').addEventListener('click', (e) => {
  e.preventDefault();
  tabs.activeTabIndex = 1;
  showPanel(1);
  requestAnimationFrame(() => document.getElementById('credits')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }));
});

onReducedMotionChange(() => update());

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
document.querySelectorAll<HTMLElement>('.chart-card').forEach((c) => c.classList.add('is-loading'));

async function boot(): Promise<void> {
  const hwPromise = loadJson<HwData>('/data/hw.json')
    .then((hw) => {
      state.hw = hw;
    })
    .catch((err) => {
      state.hwFailed = true;
      console.warn('Height/weight data unavailable', err);
    });
  try {
    state.core = await corePromise;
  } catch (err) {
    console.warn(err);
    $('hero-scope').textContent = 'Could not load the data. Please reload the page.';
    document.querySelectorAll<HTMLElement>('.chart-card').forEach((c) => c.classList.remove('is-loading'));
    return;
  }
  await customElements.whenDefined('md-slider');
  const { start, end } = readSlider();
  state.filter = { ...state.filter, start, end };
  rangeOut.textContent = rangeText(state.filter);
  document.querySelectorAll<HTMLElement>('.chart-card').forEach((c) => c.classList.remove('is-loading'));
  update();
  await hwPromise;
  computeBins();
  hosts.hw.render();
}

void boot();
