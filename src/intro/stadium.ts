/**
 * Hand-built SVG "aerial" of a stadium at night (opening fly-in), seen from directly above.
 * Racetrack geometry follows the IAAF 400 m standard proportions (two straights + two bends, 8 lanes).
 */
/** Small deterministic PRNG (mulberry32) so the crowd pattern is stable between runs. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RING_LIGHTS = ['#2D9CFF', '#FFC23D', '#E4E9F5', '#1FD17A', '#FF4D68'];

/** Racetrack (stadium) outline at bend radius r around a straight of length s, centred on 0,0. */
function lane(r: number, s: number, attrs: string): string {
  return `<rect x="${(-(s / 2 + r)).toFixed(1)}" y="${(-r).toFixed(1)}" width="${(s + 2 * r).toFixed(1)}" height="${(2 * r).toFixed(1)}" rx="${r.toFixed(1)}" ${attrs}/>`;
}

export function stadiumSvg(): string {
  const R_IN = 120; // inner bend radius
  const S = 277; // straight length
  const LANE = 4.2;
  const R_OUT = R_IN + LANE * 8;

  // Concentric stand tiers (ellipses), radial aisles, and crowd-light specks.
  const tiers = [0, 1, 2, 3, 4]
    .map((i) => {
      const t = i / 4;
      return `<ellipse rx="${(338 + t * 102).toFixed(1)}" ry="${(232 + t * 116).toFixed(1)}" fill="none" stroke="rgba(201,205,224,${(0.1 + t * 0.05).toFixed(2)})" stroke-width="${i === 4 ? 1.4 : 0.8}"/>`;
    })
    .join('');
  let aisles = '';
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    aisles += `<line x1="${(338 * c).toFixed(1)}" y1="${(232 * s).toFixed(1)}" x2="${(440 * c).toFixed(1)}" y2="${(348 * s).toFixed(1)}"/>`;
  }
  const r = rng(2026);
  const groups: string[] = ['', '', ''];
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2;
    const t = 0.04 + r() * 0.92;
    const x = Math.cos(a) * (340 + t * 98);
    const y = Math.sin(a) * (234 + t * 112);
    const roll = r();
    const col = roll < 0.16 ? RING_LIGHTS[Math.floor(r() * 5)] : '#F6F1E7';
    const op = (0.25 + r() * 0.7).toFixed(2);
    const rad = (0.7 + r() * 1.3).toFixed(2);
    groups[i % 3] += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="${col}" opacity="${op}"/>`;
  }
  const crowd = groups.map((g, i) => `<g class="fz-crowd fz-crowd--${i}">${g}</g>`).join('');

  // Light pylons around the rim, each casting a cone + radial glow in a ring colour.
  let pylonDefs = '';
  let cones = '';
  let pylons = '';
  const N = 10;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.PI / N;
    const px = Math.cos(a) * 462;
    const py = Math.sin(a) * 366;
    const col = RING_LIGHTS[i % 5];
    pylonDefs += `<linearGradient id="fz-cone-${i}" gradientUnits="userSpaceOnUse" x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="0" y2="0">
      <stop offset="0" stop-color="${col}" stop-opacity=".55"/><stop offset=".7" stop-color="${col}" stop-opacity=".08"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>
      <radialGradient id="fz-glow-${i}"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".18" stop-color="${col}" stop-opacity=".75"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
    // Cone: narrow at the pylon, wide over the infield.
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const tx = Math.cos(a) * 60;
    const ty = Math.sin(a) * 40;
    const w0 = 6;
    const w1 = 120;
    cones += `<polygon class="fz-cone" points="${(px + nx * w0).toFixed(1)},${(py + ny * w0).toFixed(1)} ${(px - nx * w0).toFixed(1)},${(py - ny * w0).toFixed(1)} ${(tx - nx * w1).toFixed(1)},${(ty - ny * w1).toFixed(1)} ${(tx + nx * w1).toFixed(1)},${(ty + ny * w1).toFixed(1)}" fill="url(#fz-cone-${i})"/>`;
    pylons += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="46" fill="url(#fz-glow-${i})"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.2" fill="#fff"/>`;
  }

  let lanes = '';
  for (let k = 0; k <= 8; k++) lanes += lane(R_IN + k * LANE, S, `fill="none" stroke="rgba(246,241,231,${k === 0 || k === 8 ? 0.6 : 0.32})" stroke-width="${k === 0 || k === 8 ? 0.9 : 0.55}"`);

  return `<svg class="fz-stadium__svg" viewBox="-500 -400 1000 800" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="fz-ground" cx="0" cy="0" r="500" gradientUnits="userSpaceOnUse">
      <stop offset=".6" stop-color="#0c1430"/><stop offset="1" stop-color="#070b1a" stop-opacity="0"/></radialGradient>
    <radialGradient id="fz-stands" cx="0" cy="0" r="440" gradientUnits="userSpaceOnUse">
      <stop offset=".7" stop-color="#1c2860"/><stop offset="1" stop-color="#0f1738"/></radialGradient>
    <linearGradient id="fz-field" x1="0" y1="-1" x2="0" y2="1">
      <stop offset="0" stop-color="#1c7a4c"/><stop offset="1" stop-color="#0f4a30"/></linearGradient>
    <pattern id="fz-mow" width="40" height="240" patternUnits="userSpaceOnUse" x="-20" y="-120">
      <rect width="20" height="240" fill="rgba(255,255,255,.035)"/></pattern>
    <radialGradient id="fz-core" cx="0" cy="0" r="150" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFDF7" stop-opacity=".95"/><stop offset=".35" stop-color="#F3DC9C" stop-opacity=".45"/><stop offset="1" stop-color="#F3DC9C" stop-opacity="0"/></radialGradient>
    ${pylonDefs}
  </defs>
  <ellipse rx="500" ry="400" fill="url(#fz-ground)"/>
  <ellipse rx="474" ry="378" fill="#121a40" stroke="rgba(232,200,114,.42)" stroke-width="1.2"/>
  <ellipse rx="446" ry="352" fill="url(#fz-stands)"/>
  <g>${tiers}</g>
  <g stroke="rgba(7,11,26,.55)" stroke-width="1.6">${aisles}</g>
  ${crowd}
  <ellipse rx="336" ry="230" fill="#0c1330" stroke="rgba(232,200,114,.35)" stroke-width="1"/>
  ${lane(R_OUT + 6, S, 'fill="#5a2a1f"')}
  ${lane(R_OUT, S, 'fill="#b4523a"')}
  ${lanes}
  ${lane(R_IN, S, 'fill="url(#fz-field)"')}
  ${lane(R_IN - 1, S, 'fill="url(#fz-mow)"')}
  <g fill="none" stroke="rgba(246,241,231,.38)" stroke-width=".8">
    <rect x="-132" y="-84" width="264" height="168"/>
    <line x1="0" y1="-84" x2="0" y2="84"/>
    <circle r="23"/>
    <rect x="-132" y="-40" width="30" height="80"/><rect x="102" y="-40" width="30" height="80"/>
  </g>
  <line x1="${-S / 2}" y1="${R_IN}" x2="${-S / 2}" y2="${R_OUT}" stroke="#F6F1E7" stroke-width="1.4" opacity=".75"/>
  <g class="fz-cones" style="mix-blend-mode:screen">${cones}</g>
  <g class="fz-pylons" style="mix-blend-mode:screen">${pylons}</g>
  <circle class="fz-core" r="150" fill="url(#fz-core)"/>
</svg>`;
}
