/**
 * Hand-entered host-city coordinates (decimal degrees, WGS84; city centre, rounded to 0.01°).
 * Keys are the exact `city` strings used in public/data/core.json games[].
 * Milano-Cortina is a two-city Games: we use a midpoint over Northern Italy (Milan ↔ Cortina).
 */
export interface LatLon {
  lat: number;
  lon: number;
}

export const HOST_CITIES: Record<string, LatLon> = {
  Athina: { lat: 37.98, lon: 23.73 },
  Paris: { lat: 48.86, lon: 2.35 },
  'St. Louis': { lat: 38.63, lon: -90.2 },
  London: { lat: 51.51, lon: -0.13 },
  Stockholm: { lat: 59.33, lon: 18.07 },
  Antwerpen: { lat: 51.22, lon: 4.4 },
  Chamonix: { lat: 45.92, lon: 6.87 },
  Amsterdam: { lat: 52.37, lon: 4.9 },
  'Sankt Moritz': { lat: 46.5, lon: 9.84 },
  'Los Angeles': { lat: 34.05, lon: -118.24 },
  'Lake Placid': { lat: 44.28, lon: -73.98 },
  Berlin: { lat: 52.52, lon: 13.4 },
  'Garmisch-Partenkirchen': { lat: 47.49, lon: 11.1 },
  Helsinki: { lat: 60.17, lon: 24.94 },
  Oslo: { lat: 59.91, lon: 10.75 },
  Melbourne: { lat: -37.81, lon: 144.96 },
  // 1956: Melbourne, with the equestrian events held in Stockholm; plotted at Melbourne.
  'Melbourne / Stockholm': { lat: -37.81, lon: 144.96 },
  "Cortina d'Ampezzo": { lat: 46.54, lon: 12.14 },
  Roma: { lat: 41.9, lon: 12.5 },
  'Squaw Valley': { lat: 39.2, lon: -120.24 },
  Tokyo: { lat: 35.68, lon: 139.69 },
  Innsbruck: { lat: 47.27, lon: 11.4 },
  'Mexico City': { lat: 19.43, lon: -99.13 },
  Grenoble: { lat: 45.19, lon: 5.72 },
  Munich: { lat: 48.14, lon: 11.58 },
  Sapporo: { lat: 43.06, lon: 141.35 },
  Montreal: { lat: 45.5, lon: -73.57 },
  Moskva: { lat: 55.76, lon: 37.62 },
  Sarajevo: { lat: 43.86, lon: 18.41 },
  Seoul: { lat: 37.57, lon: 126.98 },
  Calgary: { lat: 51.05, lon: -114.07 },
  Barcelona: { lat: 41.39, lon: 2.17 },
  Albertville: { lat: 45.68, lon: 6.39 },
  Lillehammer: { lat: 61.12, lon: 10.47 },
  Atlanta: { lat: 33.75, lon: -84.39 },
  Nagano: { lat: 36.65, lon: 138.18 },
  Sydney: { lat: -33.87, lon: 151.21 },
  'Salt Lake City': { lat: 40.76, lon: -111.89 },
  Torino: { lat: 45.07, lon: 7.69 },
  Beijing: { lat: 39.9, lon: 116.41 },
  Vancouver: { lat: 49.28, lon: -123.12 },
  Sochi: { lat: 43.6, lon: 39.73 },
  'Rio de Janeiro': { lat: -22.91, lon: -43.17 },
  PyeongChang: { lat: 37.37, lon: 128.39 },
  'Milano-Cortina': { lat: 45.9, lon: 10.5 },
};

/** Where the descent lands: Northern Italy, between Milan and Cortina. */
export const DESCENT_TARGET: LatLon = HOST_CITIES['Milano-Cortina'];

export interface HostPoint extends LatLon {
  year: number;
  season: 'Summer' | 'Winter';
  city: string;
}

/** Resolve every Games to a point. Unknown cities are skipped with a console.warn (never an error). */
export function hostPoints(games: { year: number; season: 'Summer' | 'Winter'; city: string }[]): (HostPoint | null)[] {
  const missing = new Set<string>();
  const out = games.map((g) => {
    const ll = HOST_CITIES[g.city];
    if (!ll) {
      missing.add(g.city);
      return null;
    }
    return { ...ll, year: g.year, season: g.season, city: g.city };
  });
  if (missing.size) console.warn(`[hostCities] No coordinates for: ${[...missing].join(', ')}`);
  return out;
}
