const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const EMPTY = '—';

export function fmtInt(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? EMPTY : intFmt.format(Math.round(v));
}

/** Fixed decimals, matching Python's f'{v:.Nf}' (round-half-even differences are negligible here). */
export function fmtFixed(v: number | null | undefined, digits: number): string {
  if (v == null || !Number.isFinite(v)) return EMPTY;
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(part: number, whole: number, digits = 0): string {
  if (!whole) return EMPTY;
  return `${((part / whole) * 100).toFixed(digits)}%`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
