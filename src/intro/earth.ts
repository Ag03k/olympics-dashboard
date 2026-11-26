/**
 * Real-imagery globe for the opening intro: one full-screen quad, analytic ray–sphere hit in the
 * fragment shader, nested equirectangular (EPSG:4326) imagery levels cross-faded at their edges.
 *
 * Imagery (public/img/earth/):
 *   L0 NASA Blue Marble Next Generation via NASA GIBS (public domain), global
 *   L1 NASA Blue Marble NG via GIBS, Europe
 *   L2–L4 Sentinel-2 cloudless 2016 by EOX IT Services GmbH (https://s2maps.eu), CC BY 4.0
 *         (Contains modified Copernicus Sentinel data 2016): Alps, Milano, San Siro
 */

export interface Level {
  url: string;
  /** lon0, lon1, lat0, lat1 (degrees); image row 0 = lat1 (north) */
  b: [number, number, number, number];
  /** approximate ground extent of the level's shorter side at 45.5° N, km */
  extentKm: number;
}

export const LEVELS: Level[] = [
  { url: '/img/earth/earth-l0-global.webp', b: [-180, 180, -90, 90], extentKm: 20000 },
  { url: '/img/earth/earth-l1-europe.webp', b: [-2, 22, 36, 56], extentKm: 1870 },
  { url: '/img/earth/earth-l2-alps.webp', b: [6.5, 11.5, 43.5, 47.5], extentKm: 390 },
  { url: '/img/earth/earth-l3-milano.webp', b: [8.94, 9.34, 45.33, 45.63], extentKm: 31 },
  { url: '/img/earth/earth-l4-sansiro.webp', b: [9.094, 9.154, 45.458, 45.498], extentKm: 4.45 },
];

export const EARTH_KM = 6371;
export const FOV_DEG = 35; // vertical

type Img = ImageBitmap | HTMLImageElement;

async function loadImage(url: string, high: boolean): Promise<Img> {
  if (typeof createImageBitmap === 'function') {
    const init: RequestInit & { priority?: string } = { priority: high ? 'high' : 'auto' };
    const res = await fetch(url, init as RequestInit);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const blob = await res.blob();
    // Keep the file's own orientation (row 0 = north) and colours untouched.
    return createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' } as ImageBitmapOptions);
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

/** Fetching starts as soon as this module is evaluated (i.e. when the intro chunk loads). */
export const imagery: Promise<Img>[] = LEVELS.map((l, i) => loadImage(l.url, i === 0));
imagery.forEach((p) => p.catch(() => undefined)); // no unhandled rejections; levels just stay coarse

const VS = `
attribute vec2 aPos;
varying vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vNdc;
uniform vec3 uO;      // camera position (Earth radius = 1)
uniform float uC;     // |O|^2 - 1, computed on the CPU as alt * (2 + alt)
uniform vec3 uR, uU, uF; // camera right / up / forward
uniform vec2 uTan;    // tan(fov/2) * (aspect, 1)
uniform vec3 uSun;
uniform float uFx;    // atmosphere / limb / lighting strength (0 at aerial-photo scale)
uniform float uFade;
uniform vec4 uMix;    // per-level weights for L1..L4 (0 = not loaded / not needed yet)
uniform vec4 uB1, uB2, uB3, uB4; // lon0, lon1, lat0, lat1
uniform sampler2D uT0, uT1, uT2, uT3, uT4;

const float PI = 3.14159265358979;
const float DEG = 57.2957795130823;

float edge(vec2 uv) {
  vec2 a = smoothstep(0.0, 0.06, uv) * smoothstep(0.0, 0.06, 1.0 - uv);
  return a.x * a.y;
}
vec2 lvUv(vec2 ll, vec4 b) {
  return vec2((ll.x - b.x) / (b.y - b.x), (b.w - ll.y) / (b.w - b.z));
}
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 d = normalize(uF + vNdc.x * uTan.x * uR + vNdc.y * uTan.y * uU);
  float b = dot(uO, d);
  float disc = b * b - uC;
  float hit = step(0.0, disc) * step(b, 0.0);
  // Stable near root: t = c / (-b + sqrt(b^2 - c)) (no cancellation when the camera hugs the surface).
  float t = uC / (-b + sqrt(max(disc, 0.0)));
  // Misses still produce a (closest-approach) point so texture fetches stay in uniform control flow.
  float tc = max(-b, 0.0);
  vec3 p = mix(uO + tc * d, uO + t * d, hit);
  vec3 n = normalize(p);
  vec2 ll = vec2(atan(n.y, n.x), atan(n.z, length(n.xy))) * DEG; // lon, lat

  vec3 col = texture2D(uT0, vec2(ll.x / 360.0 + 0.5, 0.5 - ll.y / 180.0)).rgb;
  vec2 uv;
  uv = lvUv(ll, uB1); col = mix(col, texture2D(uT1, uv).rgb, uMix.x * edge(uv));
  uv = lvUv(ll, uB2); col = mix(col, texture2D(uT2, uv).rgb, uMix.y * edge(uv));
  uv = lvUv(ll, uB3); col = mix(col, texture2D(uT3, uv).rgb, uMix.z * edge(uv));
  uv = lvUv(ll, uB4); col = mix(col, texture2D(uT4, uv).rgb, uMix.w * edge(uv));

  // Lighting in linear light, then back to sRGB.
  vec3 lin = pow(col, vec3(2.2));
  float mu = clamp(dot(n, -d), 0.0, 1.0);
  float ndl = dot(n, uSun);
  float light = 0.28 + 0.85 * smoothstep(-0.25, 1.0, ndl);
  float limb = 0.55 + 0.45 * pow(mu, 0.45);
  lin *= mix(1.0, light * limb, uFx);
  vec3 ground = pow(lin, vec3(1.0 / 2.2));
  ground = mix(ground, ground * ground * (3.0 - 2.0 * ground), 0.14); // gentle contrast

  // Atmosphere: rim on the disc + glow beyond the limb from the ray's closest distance to the centre.
  vec3 atmo = vec3(0.36, 0.62, 1.0);
  float sunSide = 0.35 + 0.65 * smoothstep(-0.4, 0.7, dot(n, uSun));
  ground += atmo * (pow(1.0 - mu, 3.0) * 0.55 * sunSide * uFx);
  float dmin = sqrt(max(dot(uO, uO) - b * b, 1.0));
  float glow = exp(-(dmin - 1.0) * 38.0) * step(b, 0.0) * sunSide * uFx;

  // Stars where the ray misses.
  vec3 sd = d * 420.0;
  vec3 cell = floor(sd);
  float h = hash(cell);
  vec3 sp = cell + 0.5 + 0.35 * (vec3(hash(cell + 7.1), hash(cell + 3.7), hash(cell + 9.3)) - 0.5);
  float star = step(0.9965, h) * smoothstep(0.42, 0.0, length(sd - sp)) * (0.35 + 0.65 * fract(h * 413.0));
  vec3 space = vec3(0.004, 0.006, 0.016) + vec3(0.86, 0.9, 1.0) * star * (1.0 - min(glow * 3.0, 1.0)) * uFx;
  space += atmo * glow * 0.75;

  vec3 outc = mix(space, ground, hit);
  gl_FragColor = vec4(outc * uFade, 1.0);
}`;

export interface Camera {
  lat: number;
  lon: number;
  /** altitude above the surface, Earth radii */
  alt: number;
  fade: number;
}

export interface Globe {
  draw(cam: Camera): void;
  resize(): void;
  /** visible width (km) along the larger screen dimension at a given altitude */
  altitudeForWidth(km: number): number;
  ready: Promise<boolean>;
  dispose(): void;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createGlobe(canvas: HTMLCanvasElement): Globe | null {
  const attrs: WebGLContextAttributes = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
  const gl2 = canvas.getContext('webgl2', attrs);
  const gl: WebGLRenderingContext | WebGL2RenderingContext | null = gl2 ?? canvas.getContext('webgl', attrs);
  if (!gl) return null;
  const isGL2 = !!gl2;

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  } catch (e) {
    console.warn('Intro globe shader failed', e);
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = {
    O: U('uO'), C: U('uC'), R: U('uR'), Up: U('uU'), F: U('uF'), Tan: U('uTan'), Sun: U('uSun'),
    Fx: U('uFx'), Fade: U('uFade'), Mix: U('uMix'),
  };
  LEVELS.slice(1).forEach((l, i) => gl.uniform4f(U(`uB${i + 1}`), l.b[0], l.b[1], l.b[2], l.b[3]));

  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const maxAniso = aniso ? Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number) : 0;
  const loaded = LEVELS.map(() => false);
  const textures = LEVELS.map((_, i) => {
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U(`uT${i}`), i);
    return tex;
  });

  const upload = (i: number, img: Img) => {
    if (lost) {
      if ('close' in img) img.close();
      return;
    }
    const pot = (n: number) => (n & (n - 1)) === 0;
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, textures[i]);
    // Row 0 of every image is north; we upload unflipped and map v = (latMax − lat) / span in the shader.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    const mips = isGL2 || (pot(img.width) && pot(img.height));
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, i === 0 && mips ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    if (aniso && maxAniso > 1) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    if ('close' in img) img.close();
    loaded[i] = true;
  };

  // Decoded images are queued and uploaded at most one per frame (spreads the upload hitch).
  const queue: [number, Img][] = [];
  let lost = false;
  imagery.forEach((p, i) => p.then((img) => (i === 0 ? upload(0, img) : queue.push([i, img]))).catch(() => undefined));
  const ready = imagery[0].then(() => !lost, () => false);

  let w = 1;
  let h = 1;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  };
  resize();

  const tanH = Math.tan((FOV_DEG * Math.PI) / 360);
  const altitudeForWidth = (km: number) => km / (2 * tanH * EARTH_KM * Math.max(1, w / h));

  const draw = (cam: Camera) => {
    if (lost) return;
    const q = queue.shift();
    if (q) upload(q[0], q[1]);
    const r = Math.PI / 180;
    const la = cam.lat * r, lo = cam.lon * r;
    const cl = Math.cos(la), sl = Math.sin(la), co = Math.cos(lo), so = Math.sin(lo);
    const up = [cl * co, cl * so, sl];          // surface normal under the camera
    const east = [-so, co, 0];
    const north = [-sl * co, -sl * so, cl];
    const k = 1 + cam.alt;
    gl.uniform3f(u.O, up[0] * k, up[1] * k, up[2] * k);
    gl.uniform1f(u.C, cam.alt * (2 + cam.alt));
    // Nadir camera: forward = −up, screen-up = north, screen-right = east.
    gl.uniform3f(u.R, east[0], east[1], east[2]);
    gl.uniform3f(u.Up, north[0], north[1], north[2]);
    gl.uniform3f(u.F, -up[0], -up[1], -up[2]);
    gl.uniform2f(u.Tan, tanH * (w / h), tanH);
    // Sun from the upper-left, towards the viewer (fixed in camera space).
    const s = [-0.5, 0.55, 0.65];
    const sn = Math.hypot(s[0], s[1], s[2]);
    gl.uniform3f(u.Sun,
      (s[0] * east[0] + s[1] * north[0] + s[2] * up[0]) / sn,
      (s[0] * east[1] + s[1] * north[1] + s[2] * up[1]) / sn,
      (s[0] * east[2] + s[1] * north[2] + s[2] * up[2]) / sn);
    const lnA = Math.log(cam.alt);
    gl.uniform1f(u.Fx, smooth(Math.log(0.008), Math.log(0.3), lnA));
    gl.uniform1f(u.Fade, cam.fade);
    // A finer level fades in once it covers the view (view width 2× → 1× the level's extent), so a
    // differently-graded source never shows as a small patch; the shader edge-fades it into the coarser one.
    const viewKm = 2 * tanH * cam.alt * EARTH_KM * Math.max(1, w / h);
    const mix = [1, 2, 3, 4].map((i) => (loaded[i] ? 1 - smooth(LEVELS[i].extentKm, LEVELS[i].extentKm * 2, viewKm) : 0));
    gl.uniform4f(u.Mix, mix[0], mix[1], mix[2], mix[3]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const dispose = () => {
    if (lost) return;
    lost = true;
    queue.forEach(([, img]) => 'close' in img && img.close());
    queue.length = 0;
    textures.forEach((t) => gl.deleteTexture(t));
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };

  return { draw, resize, altitudeForWidth, ready, dispose };
}
