# Atlas of Olympians — Olympics Dashboard 1896–2026

An interactive dashboard of 130 years of Olympic history, from **Athens 1896** to **Milano-Cortina 2026**:
participation by sex, top nations (medals or entries) with a podium, height vs weight, the age of medal winners,
how athletes' height, age and weight have changed over time, and age by sport. It covers 56 Games and 315,094
athlete-event rows.

This is the **rebuild** branch: a static Vite + TypeScript site that replaces the original Plotly Dash app.

- **Live preview:** https://atlas-of-olympians-rebuild.onrender.com (free Render static site `atlas-of-olympians-rebuild`, auto-deploys from `rebuild`)
- The legacy Dash app (`app.py`, `requirements.txt`, `Procfile.txt`) is still in this branch, untouched, for reference.
  The `main` branch and atlas-of-olympians.onrender.com are unchanged.

## Stack

- [Vite](https://vite.dev) + TypeScript (vanilla, no framework)
- [Material Web](https://github.com/material-components/material-web) (Material Design 3 components) with M3 design tokens as CSS custom properties (`src/styles/tokens.css`)
- [Apache ECharts](https://echarts.apache.org) (tree-shaken via `echarts/core`) with a custom theme mirrored from the tokens (`src/theme.ts`)
- Self-hosted variable fonts in `public/fonts/` (see [Fonts](#fonts)) and Material Symbols icons inlined as SVG (`@material-symbols/svg-400`)
- [GSAP](https://gsap.com) and a small hand-written WebGL globe for the opening intro (lazy-loaded, see [Opening intro](#opening-intro))
- No runtime requests to any third-party origin: data, fonts, icons and images are served from the site's own origin.

## Run locally

Requires Node 20.19+ (see `.nvmrc`, Node 22).

```bash
npm ci            # install dependencies
npm run dev       # dev server at http://localhost:5173
npm run build     # type-check (tsc --noEmit) and build to dist/
npm run preview   # serve dist/ at http://localhost:4173
```

## Opening intro

On load, a ~6 s "Google Earth" zoom plays (`src/intro/`): a WebGL globe textured with real satellite imagery
(nested equirectangular levels in `public/img/earth/`, cross-faded in the shader) turns from the whole planet to Milan and
descends straight down onto Stadio San Siro, the Milano–Cortina 2026 opening-ceremony venue; an iris then opens onto the hero
and the hero reveals itself. It is lazy-loaded, so the dashboard data loads in parallel. Without WebGL, or if the base imagery
isn't loaded within 2.5 s, it goes straight to the hero reveal.

- **Skip intro** button (bottom-right), or any key, wheel, touch or click: jumps to the hero's final state in ~300 ms.
- `?nointro=1`: no fly-in; the hero reveal still plays.
- `?static=1`: no animation at all; final state immediately.
- `prefers-reduced-motion: reduce`: no fly-in; the hero simply fades in.
- `window.__introDone` / `window.__heroReady` are set to `true` when the overlay is gone / the hero reveal has finished.

## Fonts

Self-hosted variable WOFF2 files in `public/fonts/`, each with its license text alongside (`OFL-*.txt`). All are under the
[SIL Open Font License 1.1](https://openfontlicense.org).

| Font | Use | File | Source |
| --- | --- | --- | --- |
| Hubot Sans (GitHub) | display: wordmark (width 125), headings | `HubotSans-VF.woff2` | https://github.com/github/hubot-sans |
| Mona Sans (GitHub) | body text | `MonaSans-VF.woff2` | https://github.com/github/mona-sans |
| Martian Mono (Evil Martians) | hero and stat-card numbers, intro captions | `MartianMono-VF.woff2` | https://github.com/evilmartians/mono |

## Rebuild the data

The site ships pre-aggregated JSON in `public/data/` (committed), so deploys only need `npm ci && npm run build`.
To regenerate it:

```bash
python3 scripts/build_data.py
```

The script uses only the Python standard library. It reads `data-raw/athlete_events_through_2026.csv` if present
(`data-raw/` is git-ignored); otherwise it downloads the file from the pinned source commit:

- Source repo: https://github.com/ismayc/olympic-moderndive-data
- Pinned commit: `d7f254a486c6a24c9b1680cba1747e5d4eabc1a8`
- File: `athlete_events_through_2026.csv`

Cleaning matches the original app: numeric Year/Age/Height/Weight (blank or `NA` → missing), Sex M/F → Male/Female,
rows without a Year dropped, Olympedia sport names kept as-is, a medal row is any row with a non-empty Medal.
The script prints verification numbers (315,094 rows; 271,116 rows and 135,571 unique athletes for 1896–2016;
5,415 rows for 2026 Winter; 1980–2016 averages 175.8 cm / 71.0 kg / 25 years, 48 sports) and the output sizes.

### Data files

All aggregates are additive (sums and counts per Games, never pre-averaged), so the browser recomputes every number
exactly for any year range and season.

| File | Contents |
| --- | --- |
| `public/data/core.json` | Per Games (Year + Season): rows by sex; gold/silver/bronze medal rows; sports (indices into a dictionary); sum and count of height, weight and age by sex; per-NOC entries and medal rows; integer-age histograms by medal status and sex (for box plots); per-sport age sums and counts by sex. Also the NOC → display name dictionary (most common `Team` per NOC) and unique-athlete patterns (athletes grouped by their exact set of Games). |
| `public/data/hw.json` | Per Games: height × weight 2D histogram on an integer cm/kg grid (re-binned in the browser for the heatmap). |
| `public/data/meta.json` | Source repo, pinned commit, generation time, row and athlete counts. |

About 150 KB gzipped in total.

## Deploy (Render)

`render.yaml` is a Render Blueprint for one free static site, `atlas-of-olympians-rebuild`, built from the `rebuild`
branch with `npm ci && npm run build` and published from `./dist`. Hashed assets under `/assets/*` are cached for a
year; `/data/*` and `/img/*` for an hour.

## Credits and license

**Dataset:** "Olympic History through 2026" by Chester Ismay, https://github.com/ismayc/olympic-moderndive-data
(pinned commit `d7f254a`), built on Olympedia (OlyMADMen, https://www.olympedia.org) and Griffin (2018),
https://github.com/rgriff23/Olympic_history. License: **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/),
as stated in the repository README for the packaged `olympicAthletes` data. This site aggregates the data; no rows
are altered.

Citations:

- Griffin, R. (2018). *Olympic history dataset*. https://github.com/rgriff23/Olympic_history
- OlyMADMen. *Olympedia*. https://www.olympedia.org
- Ismay, C. (2026). *olympicAthletes* (R package, moderndive).

**Images:**

- `public/img/olympic-rings.svg`: "Olympic rings without rims.svg", Wikimedia Commons,
  https://commons.wikimedia.org/wiki/File:Olympic_rings_without_rims.svg. Public domain (design by Pierre de Coubertin).
  The Olympic rings are a trademark of the IOC; shown unaltered as the header logo, as in the original app.
- `public/img/earth/*.webp` (opening intro). Earth imagery: NASA Blue Marble Next Generation (NASA Earth Observatory / NASA GIBS,
  public domain); Sentinel-2 cloudless 2016 by EOX IT Services GmbH — https://s2maps.eu (Contains modified Copernicus Sentinel
  data 2016), CC BY 4.0.
- `public/img/stadium-*.webp` (Panathinaiko Stadium panorama by Craig Patik, public domain) are no longer shown on the site
  and remain in the repo only as unused files.
- `public/favicon.svg`: a simple medal drawn for this project.

Fonts: Hubot Sans, Mona Sans (GitHub) and Martian Mono (Evil Martians), SIL OFL 1.1; see [Fonts](#fonts). Icons: Material Symbols (Apache 2.0).
