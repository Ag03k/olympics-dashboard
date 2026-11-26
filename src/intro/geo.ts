/**
 * Cartography for the opening fly-in (src/intro/intro.ts): Natural Earth 1:110m (public domain) via
 * world-atlas, bundled locally. Only imported dynamically so the main bundle stays light.
 */
import { geoGraticule10, geoOrthographic, geoPath, geoDistance, type GeoProjection, type GeoPermissibleObjects } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import type { HostPoint } from './hostCities';

const topo = world as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
export const LAND = feature(topo, topo.objects.land) as GeoPermissibleObjects;
export const BORDERS = mesh(topo, topo.objects.countries, (a, b) => a !== b) as GeoPermissibleObjects;
export const GRATICULE = geoGraticule10();
const SPHERE: GeoPermissibleObjects = { type: 'Sphere' };

export const GEO_CREDIT = 'Map: Natural Earth (public domain) via world-atlas.';

export const PAL = {
  ocean0: '#0d1736',
  ocean1: '#070c22',
  land: '#26346b',
  landHi: '#2f3f7e',
  coast: 'rgba(243, 220, 156, 0.72)',
  border: 'rgba(201, 205, 224, 0.16)',
  grat: 'rgba(201, 205, 224, 0.09)',
  summer: [243, 220, 156] as const,
  winter: [150, 210, 255] as const,
  gold: '#e8c872',
};

export { geoOrthographic, geoDistance };

export function rgba(c: readonly [number, number, number], a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

/** Fit a canvas to its CSS box at devicePixelRatio (capped at 2). Returns CSS size. */
export function fitCanvas(cv: HTMLCanvasElement): { w: number; h: number; dpr: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 1;
  const h = cv.clientHeight || 1;
  const W = Math.round(w * dpr);
  const H = Math.round(h * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  cv.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr };
}

export interface GlobeStyle {
  /** 0..1 strength of the atmosphere ring */
  glow?: number;
  /** stroke widths scale (thin on mini map) */
  line?: number;
  borders?: boolean;
}

/** Draw atmosphere, ocean, graticule, land, borders and coastline for a projection. */
export function drawGlobe(ctx: CanvasRenderingContext2D, proj: GeoProjection, style: GlobeStyle = {}): void {
  const path = geoPath(proj, ctx);
  const [cx, cy] = proj.translate();
  const r = proj.scale();
  const line = style.line ?? 1;
  const glow = style.glow ?? 1;

  // Atmosphere: soft indigo→champagne halo just outside the limb (skip when the limb is off-screen).
  if (glow > 0 && r < 6000) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.22);
    g.addColorStop(0, `rgba(120, 160, 255, ${0.34 * glow})`);
    g.addColorStop(0.25, `rgba(232, 200, 114, ${0.12 * glow})`);
    g.addColorStop(1, 'rgba(45, 75, 170, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ocean with a faint terminator-style light falloff.
  const og = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
  og.addColorStop(0, PAL.ocean0);
  og.addColorStop(1, PAL.ocean1);
  ctx.beginPath();
  path(SPHERE);
  ctx.fillStyle = og;
  ctx.fill();

  ctx.beginPath();
  path(GRATICULE);
  ctx.strokeStyle = PAL.grat;
  ctx.lineWidth = 0.6 * line;
  ctx.stroke();

  ctx.beginPath();
  path(LAND);
  const lg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r);
  lg.addColorStop(0, PAL.landHi);
  lg.addColorStop(1, PAL.land);
  ctx.fillStyle = lg;
  ctx.fill();

  if (style.borders !== false) {
    ctx.beginPath();
    path(BORDERS);
    ctx.strokeStyle = PAL.border;
    ctx.lineWidth = 0.5 * line;
    ctx.stroke();
  }

  ctx.beginPath();
  path(LAND);
  ctx.strokeStyle = PAL.coast;
  ctx.lineWidth = 0.7 * line;
  ctx.stroke();

  // Limb rim light.
  ctx.beginPath();
  path(SPHERE);
  ctx.strokeStyle = 'rgba(201, 214, 255, 0.28)';
  ctx.lineWidth = 1 * line;
  ctx.stroke();
}

/** Is a lon/lat on the visible hemisphere of an orthographic projection? */
export function isVisible(proj: GeoProjection, p: { lon: number; lat: number }): boolean {
  const rot = proj.rotate();
  return geoDistance([p.lon, p.lat], [-rot[0], -rot[1]]) < Math.PI / 2 - 0.02;
}

/** Glowing host-city dot. `a` is 0..1 brightness, `flash` 0..1 extra bloom (just lit). */
export function drawCity(ctx: CanvasRenderingContext2D, x: number, y: number, p: HostPoint, a: number, size: number, flash = 0): void {
  const col = p.season === 'Winter' ? PAL.winter : PAL.summer;
  const R = size * (3.2 + flash * 4);
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, rgba(col, Math.min(1, a * (0.55 + flash * 0.45))));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 252, 244, ${a.toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.75, 0, Math.PI * 2);
  ctx.fill();
}
