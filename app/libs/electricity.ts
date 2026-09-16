import type { KafaiRecord } from "./api";
export const DAY = 86400000;
export const round = (v: number) => Math.round(v * 1e6) / 1e6;
export const absolute = (r: KafaiRecord) =>
  round((r.meterReading || 0) + (r.cycle || 0) * (r.modulus || 10000));
export const localInput = (v: string | number = Date.now()) =>
  new Date(new Date(v).getTime() + 7 * 3600000).toISOString().slice(0, 16);
export const dayKey = (v: string | number) => localInput(v).slice(0, 10);
export const localISO = (v: string) =>
  new Date(`${v.length === 10 ? `${v}T00:00` : v}+07:00`).toISOString();
export const dateLabel = (v: string | number, time = false) =>
  new Date(v).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
export const fmt = (v: number | null | undefined, digits = 2) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("th-TH", { maximumFractionDigits: digits });
export const meter = (v?: number) =>
  v == null
    ? "—"
    : v
        .toFixed(1)
        .replace(/\.0$/, "")
        .padStart(v % 1 ? 6 : 4, "0");
export interface Interval {
  id: string;
  startId: string;
  start: number;
  end: number;
  kwh: number;
  days: number;
  daily: number;
  source: "measured" | "reconstructed";
  rollover: boolean;
  seriesId: string;
  allocated?: boolean;
}
export interface Bucket {
  key: string;
  kwh: number;
  days: number;
  estimated: boolean;
  ids: string[];
  reconstructed: boolean;
}
export function buildIntervals(records: KafaiRecord[]) {
  const readings = records
    .filter((r) => r.recordType === "meter_reading")
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  const previous = new Map<string, KafaiRecord>();
  const intervals: Interval[] = [];
  const invalid: string[] = [];
  for (const r of readings) {
    const key = r.seriesId || "main",
      p = previous.get(key);
    previous.set(key, r);
    if (!p) continue;
    const start = Date.parse(p.recordedAt),
      end = Date.parse(r.recordedAt),
      kwh = round(absolute(r) - absolute(p)),
      days = (end - start) / DAY;
    if (
      days <= 0 ||
      kwh < 0 ||
      !Number.isFinite(kwh) ||
      r.modulus !== p.modulus
    ) {
      invalid.push(r._id);
      continue;
    }
    intervals.push({
      id: r._id,
      startId: p._id,
      start,
      end,
      kwh,
      days,
      daily: kwh / days,
      source:
        r.source === "reconstructed" || p.source === "reconstructed"
          ? "reconstructed"
          : "measured",
      rollover: r.cycle !== p.cycle,
      seriesId: key,
    });
  }
  return {
    readings,
    intervals,
    invalid,
    legacy: records.filter((r) => r.recordType !== "meter_reading"),
  };
}
export function clipIntervals(intervals: Interval[], from: number, to: number) {
  return intervals
    .filter((i) => i.start < to && i.end > from)
    .map((i) => {
      const start = Math.max(from, i.start),
        end = Math.min(to, i.end),
        days = (end - start) / DAY;
      return {
        ...i,
        start,
        end,
        days,
        kwh: i.daily * days,
        allocated: i.allocated || start !== i.start || end !== i.end,
      };
    });
}
export function dailyBuckets(intervals: Interval[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const i of intervals) {
    let t = i.start;
    while (t < i.end) {
      const key = dayKey(t),
        midnight = Date.parse(localISO(key)),
        end = Math.min(midnight + DAY, i.end),
        days = (end - t) / DAY;
      const b = map.get(key) || {
        key,
        kwh: 0,
        days: 0,
        estimated: false,
        ids: [],
        reconstructed: false,
      };
      b.kwh += i.daily * days;
      b.days += days;
      b.estimated ||=
        !!i.allocated || i.start !== midnight || i.end !== midnight + DAY;
      b.reconstructed ||= i.source === "reconstructed";
      if (!b.ids.includes(i.id)) b.ids.push(i.id);
      map.set(key, b);
      t = end;
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export function aggregate(buckets: Bucket[], by: "day" | "week" | "month") {
  const map = new Map<string, Bucket>();
  for (const b of buckets) {
    const d = new Date(`${b.key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key =
      by === "month"
        ? b.key.slice(0, 7)
        : by === "week"
          ? d.toISOString().slice(0, 10)
          : b.key;
    const value = map.get(key) || {
      key,
      kwh: 0,
      days: 0,
      estimated: false,
      ids: [],
      reconstructed: false,
    };
    value.kwh += b.kwh;
    value.days += b.days;
    value.estimated ||= b.estimated;
    value.reconstructed ||= b.reconstructed;
    value.ids = [...new Set([...value.ids, ...b.ids])];
    map.set(key, value);
  }
  return [...map.values()];
}
export function movingAverage(buckets: Bucket[], window: number) {
  return buckets.map((b) => {
    const t = Date.parse(b.key),
      selected = buckets.filter(
        (x) => Date.parse(x.key) <= t && Date.parse(x.key) > t - window * DAY,
      );
    const days = selected.reduce((s, x) => s + x.days, 0);
    return {
      key: b.key,
      value: days ? selected.reduce((s, x) => s + x.kwh, 0) / days : null,
    };
  });
}
export function downloadCSV(
  name: string,
  rows: (string | number | boolean | null | undefined)[][],
) {
  const quote = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
