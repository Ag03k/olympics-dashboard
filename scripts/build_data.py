#!/usr/bin/env python3
"""Build compact, pre-aggregated JSON data for the Atlas of Olympians site.

Standard library only. Reads data-raw/athlete_events_through_2026.csv if it
exists, otherwise downloads it from a pinned commit of
https://github.com/ismayc/olympic-moderndive-data and caches it in data-raw/.

Writes:
  public/data/core.json  per-Games aggregates (counts, sums, NOCs, ages, sports,
                         unique-athlete patterns)
  public/data/hw.json    per-Games integer height x weight 2D histograms
  public/data/meta.json  provenance and row counts

All aggregates are additive (sums and counts, never pre-averaged means), so the
browser can combine any set of Games exactly.
"""
from __future__ import annotations

import csv
import datetime as _dt
import gzip
import json
import math
import os
import sys
import urllib.request
from collections import Counter, defaultdict

SOURCE_REPO = "https://github.com/ismayc/olympic-moderndive-data"
SOURCE_COMMIT = "d7f254a486c6a24c9b1680cba1747e5d4eabc1a8"
SOURCE_FILE = "athlete_events_through_2026.csv"
SOURCE_URL = (
    "https://raw.githubusercontent.com/ismayc/olympic-moderndive-data/"
    f"{SOURCE_COMMIT}/{SOURCE_FILE}"
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "data-raw")
RAW_PATH = os.path.join(RAW_DIR, SOURCE_FILE)
OUT_DIR = os.path.join(ROOT, "public", "data")

SEXES = ["Male", "Female"]
SEX_MAP = {"M": 0, "F": 1}
MEDALS = {"Gold": 0, "Silver": 1, "Bronze": 2}


def num(v: str):
    """Numeric value or None for blank / NA / non-numeric (pd.to_numeric errors='coerce')."""
    v = (v or "").strip()
    if v == "" or v.upper() in ("NA", "NAN", "NULL"):
        return None
    try:
        f = float(v)
    except ValueError:
        return None
    if math.isnan(f):
        return None
    return f


def ensure_raw() -> str:
    if os.path.exists(RAW_PATH):
        print(f"Using local {os.path.relpath(RAW_PATH, ROOT)}")
        return RAW_PATH
    os.makedirs(RAW_DIR, exist_ok=True)
    print(f"Downloading {SOURCE_URL}")
    tmp = RAW_PATH + ".part"
    with urllib.request.urlopen(SOURCE_URL, timeout=120) as resp, open(tmp, "wb") as out:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
    os.replace(tmp, RAW_PATH)
    return RAW_PATH


def r2(x: float) -> float:
    """Round sums to avoid float noise; inputs have at most 1 decimal."""
    v = round(x, 2)
    return int(v) if v == int(v) else v


def main() -> int:
    path = ensure_raw()

    total_rows_in_file = 0
    dropped_no_year = 0

    sports_idx: dict[str, int] = {}
    noc_idx: dict[str, int] = {}
    noc_team = defaultdict(Counter)

    games_key_idx: dict[tuple[int, str], int] = {}
    games: list[dict] = []

    athlete_games: dict[str, set[int]] = defaultdict(set)

    def game(year: int, season: str, city: str) -> int:
        key = (year, season)
        gi = games_key_idx.get(key)
        if gi is None:
            gi = len(games)
            games_key_idx[key] = gi
            games.append({
                "year": year,
                "season": season,
                "cities": [],
                "rows": [0, 0],              # by sex
                "medals": [0, 0, 0],          # gold, silver, bronze rows
                "sports": set(),
                # metric -> [sumMale, nMale, sumFemale, nFemale]
                "h": [0.0, 0, 0.0, 0], "w": [0.0, 0, 0.0, 0], "a": [0.0, 0, 0.0, 0],
                "noc": defaultdict(lambda: [0, 0, 0, 0]),   # entries, g, s, b
                "age": defaultdict(lambda: [0, 0, 0, 0]),   # age -> [nonMedM, nonMedF, medM, medF]
                "sport_age": defaultdict(lambda: [0, 0]),  # (sport, sex) -> [n, sumAge]
                "hw": Counter(),                            # (h, w) -> n
            })
        g = games[gi]
        if city and city not in g["cities"]:
            g["cities"].append(city)
        return gi

    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_rows_in_file += 1
            year = num(row["Year"])
            if year is None:
                dropped_no_year += 1
                continue
            year = int(year)
            season = row["Season"].strip()
            sex = SEX_MAP.get(row["Sex"].strip())
            if sex is None:
                raise SystemExit(f"Unexpected Sex value {row['Sex']!r}; aggregation assumes M/F only")
            gi = game(year, season, row["City"].strip())
            g = games[gi]

            g["rows"][sex] += 1
            sport = row["Sport"]
            si = sports_idx.setdefault(sport, len(sports_idx))
            g["sports"].add(si)

            noc = row["NOC"].strip()
            ni = noc_idx.setdefault(noc, len(noc_idx))
            noc_team[noc][row["Team"].strip()] += 1
            nrec = g["noc"][ni]
            nrec[0] += 1

            medal = MEDALS.get(row["Medal"].strip())
            has_medal = medal is not None
            if has_medal:
                g["medals"][medal] += 1
                nrec[1 + medal] += 1

            h, w, a = num(row["Height"]), num(row["Weight"]), num(row["Age"])
            for key, v in (("h", h), ("w", w), ("a", a)):
                if v is not None:
                    g[key][sex * 2] += v
                    g[key][sex * 2 + 1] += 1
            if a is not None:
                ai = int(round(a))
                g["age"][ai][(2 if has_medal else 0) + sex] += 1
                sa = g["sport_age"][(si, sex)]
                sa[0] += 1
                sa[1] += a
            if h is not None and w is not None:
                g["hw"][(int(math.floor(h + 0.5)), int(math.floor(w + 0.5)))] += 1

            athlete_games[row["ID"].strip()].add(gi)

    # Order games chronologically (Summer before Winter in the same year) and remap indices.
    order = sorted(range(len(games)), key=lambda i: (games[i]["year"], games[i]["season"] != "Summer"))
    remap = {old: new for new, old in enumerate(order)}
    games = [games[i] for i in order]

    sports = list(sports_idx.keys())
    nocs = list(noc_idx.keys())
    noc_names = []
    for code in nocs:
        (name, _), = noc_team[code].most_common(1)
        noc_names.append(name)

    # Unique-athlete patterns: identical sets of Games collapse into one entry with a count.
    pattern_counts = Counter()
    for gs in athlete_games.values():
        pattern_counts[tuple(sorted(remap[g] for g in gs))] += 1
    patterns = [[cnt, *pat] for pat, cnt in sorted(pattern_counts.items())]

    core_games = []
    hw_games = []
    for g in games:
        noc_flat = []
        for ni in sorted(g["noc"]):
            noc_flat.extend([ni, *g["noc"][ni]])
        age_flat = []
        for age in sorted(g["age"]):
            age_flat.extend([age, *g["age"][age]])
        sa_flat = []
        for (si, sex) in sorted(g["sport_age"]):
            n, s = g["sport_age"][(si, sex)]
            sa_flat.extend([si, sex, n, r2(s)])
        hw_flat = []
        for (hh, ww) in sorted(g["hw"]):
            hw_flat.extend([hh, ww, g["hw"][(hh, ww)]])
        core_games.append({
            "year": g["year"],
            "season": g["season"],
            "city": " / ".join(g["cities"]),
            "rows": g["rows"],
            "medals": g["medals"],
            "sports": sorted(g["sports"]),
            "h": [r2(x) for x in g["h"]],
            "w": [r2(x) for x in g["w"]],
            "a": [r2(x) for x in g["a"]],
            "hwRows": sum(g["hw"].values()),
            "noc": noc_flat,
            "age": age_flat,
            "sportAge": sa_flat,
        })
        hw_games.append(hw_flat)

    core = {
        "version": 1,
        "sexes": SEXES,
        "sports": sports,
        "nocs": nocs,
        "nocNames": noc_names,
        "games": core_games,
        "athletes": patterns,
        "layout": {
            "noc": "flat [nocIndex, entries, gold, silver, bronze] per NOC",
            "age": "flat [age, nonMedalMale, nonMedalFemale, medalMale, medalFemale]",
            "sportAge": "flat [sportIndex, sexIndex, rowsWithAge, sumAge]",
            "h/w/a": "[sumMale, nMale, sumFemale, nFemale] over non-missing values",
            "athletes": "[athleteCount, ...gameIndices] (athletes sharing the same set of Games)",
        },
    }
    hw = {
        "version": 1,
        "layout": "per Games flat [heightCm, weightKg, rows] on an integer grid (rounded half up)",
        "games": hw_games,
    }

    total_rows = sum(sum(g["rows"]) for g in games)
    meta = {
        "title": "Atlas of Olympians data",
        "sourceRepo": SOURCE_REPO,
        "sourceCommit": SOURCE_COMMIT,
        "sourceFile": SOURCE_FILE,
        "sourceUrl": SOURCE_URL,
        "license": "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
        "generated": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rowsInFile": total_rows_in_file,
        "rowsDroppedNoYear": dropped_no_year,
        "rows": total_rows,
        "athletes": len(athlete_games),
        "games": len(games),
        "sports": len(sports),
        "nocs": len(nocs),
        "yearMin": games[0]["year"],
        "yearMax": games[-1]["year"],
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    sizes = []
    for name, obj in (("core.json", core), ("hw.json", hw), ("meta.json", meta)):
        p = os.path.join(OUT_DIR, name)
        text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
        with open(p, "w", encoding="utf-8") as out:
            out.write(text)
        raw = len(text.encode("utf-8"))
        gz = len(gzip.compress(text.encode("utf-8"), 9))
        sizes.append((name, raw, gz))

    # ---------- verification ----------
    def sel(y0, y1, season=None):
        return [i for i, g in enumerate(games) if y0 <= g["year"] <= y1 and (season is None or g["season"] == season)]

    def rows(ix):
        return sum(sum(games[i]["rows"]) for i in ix)

    def uniq(ix):
        s = set(ix)
        return sum(p[0] for p in patterns if any(gi in s for gi in p[1:]))

    def mean(ix, key):
        tot = sum(games[i][key][0] + games[i][key][2] for i in ix)
        n = sum(games[i][key][1] + games[i][key][3] for i in ix)
        return tot / n if n else float("nan")

    def nsports(ix):
        return len(set().union(*(games[i]["sports"] for i in ix))) if ix else 0

    def medal_rows(ix):
        return sum(sum(games[i]["medals"]) for i in ix)

    print()
    print("Verification")
    print(f"  total rows (all):            {total_rows:,}  (expect 315,094)")
    print(f"  Games:                       {len(games)}  (expect 56)")
    a = sel(1896, 2016)
    print(f"  rows 1896-2016:              {rows(a):,}  (expect 271,116)")
    print(f"  unique athletes 1896-2016:   {uniq(a):,}  (expect 135,571)")
    print(f"  medal rows 1896-2016:        {medal_rows(a):,}")
    w26 = sel(2026, 2026, "Winter")
    print(f"  rows 2026 Winter:            {rows(w26):,}  (expect ~5,415)")
    b = sel(1980, 2016)
    print(f"  1980-2016 All: sports={nsports(b)} (expect 48), height={mean(b, 'h'):.1f} (175.8), "
          f"weight={mean(b, 'w'):.1f} (71.0), age={mean(b, 'a'):.0f} (25)")
    print(f"  unique athletes all:         {len(athlete_games):,}")

    print()
    print("Output sizes")
    total_raw = total_gz = 0
    for name, raw, gz in sizes:
        total_raw += raw
        total_gz += gz
        print(f"  public/data/{name:<10} {raw / 1024:8.1f} KB raw  {gz / 1024:8.1f} KB gzip")
    print(f"  {'total':<22} {total_raw / 1024:8.1f} KB raw  {total_gz / 1024:8.1f} KB gzip")
    if total_gz > 3 * 1024 * 1024:
        print("ERROR: compressed data exceeds 3 MB", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
