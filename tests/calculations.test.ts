import { test } from "node:test";
import assert from "node:assert/strict";
import {
  absolute,
  aggregate,
  buildIntervals,
  clipIntervals,
  dailyBuckets,
  DAY,
  dayKey,
  localISO,
} from "../app/libs/electricity";
import {
  describe,
  forecast,
  quantile,
  weightedRate,
} from "../app/libs/statistics";
import type { KafaiRecord } from "../app/libs/api";
const record = (
  id: string,
  at: string,
  value: number,
  cycle = 0,
): KafaiRecord => ({
  _id: id,
  userId: "u",
  recordedAt: localISO(at),
  meterReading: value,
  cycle,
  modulus: 10000,
  seriesId: "main",
  recordType: "meter_reading",
  source: "measured",
});
test("baseline is not consumption; out-of-order inputs and decimals", () => {
  const a = record("a", "2026-09-01", 1992),
    b = record("b", "2026-09-02", 2002),
    c = record("c", "2026-09-03", 2025);
  assert.equal(buildIntervals([a]).intervals.length, 0);
  const result = buildIntervals([c, a, b]);
  assert.deepEqual(
    result.intervals.map((i) => i.kwh),
    [10, 23],
  );
  assert.equal(weightedRate(result.intervals), 16.5);
  assert.equal(absolute(a), 1992);
  assert.equal(
    buildIntervals([
      record("x", "2026-09-01", 1992.5),
      record("y", "2026-09-02", 1993.2),
    ]).intervals[0].kwh,
    0.7,
  );
});
test("rollover, zero and retained full cycle after deleting intermediate readings", () => {
  const a = record("a", "2026-09-01", 9999),
    b = record("b", "2026-09-02", 0, 1),
    c = record("c", "2026-09-03", 3, 1);
  assert.deepEqual(
    buildIntervals([a, b, c]).intervals.map((i) => i.kwh),
    [1, 3],
  );
  assert.equal(
    buildIntervals([
      record("a", "2026-09-01", 100),
      record("b", "2026-09-04", 100, 1),
    ]).intervals[0].kwh,
    10000,
  );
  assert.equal(
    buildIntervals([
      record("a", "2026-09-01", 100),
      record("b", "2026-09-02", 100),
    ]).intervals[0].kwh,
    0,
  );
});
test("weighted daily mean uses elapsed days, not record count", () => {
  const i = buildIntervals([
    record("a", "2026-09-01", 0),
    record("b", "2026-09-02", 10),
    record("c", "2026-09-05", 70),
  ]).intervals;
  assert.equal(weightedRate(i), 17.5);
});
test("month boundaries conserve usage and monthly baht never accumulates", () => {
  const i = buildIntervals([
    record("a", "2026-01-31", 10),
    record("b", "2026-02-02", 30),
  ]).intervals;
  const days = dailyBuckets(i);
  assert.deepEqual(
    days.map((b) => b.kwh),
    [10, 10],
  );
  assert.ok(days.every((b) => b.estimated));
  assert.deepEqual(
    aggregate(days, "month").map((b) => b.kwh * 4),
    [40, 40],
  );
  const clipped = clipIntervals(
    i,
    Date.parse(localISO("2026-02-01")),
    Date.parse(localISO("2026-02-02")),
  );
  assert.equal(clipped[0].kwh, 10);
});
test("invalid intervals excluded, legacy separated and no cross-series delta", () => {
  const a = record("a", "2026-09-01", 100),
    b = record("b", "2026-09-02", 90),
    c = { ...record("c", "2026-09-03", 10), seriesId: "replacement" };
  assert.deepEqual(buildIntervals([a, b, c]).invalid, ["b"]);
  assert.equal(buildIntervals([a, b, c]).intervals.length, 0);
  assert.equal(
    buildIntervals([{ ...a, recordType: "legacy_usage", unit: 5 }]).legacy
      .length,
    1,
  );
});
test("statistical fixtures use type7 quantiles, sample SD, undefined small n", () => {
  const d = describe([1, 2, 3, 4]);
  assert.equal(d.mean, 2.5);
  assert.equal(d.q1, 1.75);
  assert.equal(d.q3, 3.25);
  assert.equal(d.variance, 5 / 3);
  assert.equal(d.mad, 1);
  assert.equal(quantile([0, 10], 0.95), 9.5);
  assert.equal(describe([1]).sd, null);
  assert.equal(describe([0, 0]).cv, null);
  assert.equal(describe([]).mean, null);
});
test("forecast requires actual contiguous days; reconstructed allocation never increases n", () => {
  const buckets = Array.from({ length: 70 }, (_, i) => ({
    key: dayKey(Date.parse(localISO("2026-01-01")) + i * DAY),
    kwh: 5,
    days: 1,
    estimated: false,
    reconstructed: false,
    ids: [],
  }));
  const f = forecast(buckets);
  assert.equal(f?.total, 35);
  assert.equal(f?.scores[0].mae, 0);
  assert.equal(f?.range, null);
  assert.equal(forecast(buckets.map((b) => ({ ...b, estimated: true }))), null);
});
test("Bangkok day, midnight and leap day", () => {
  assert.equal(dayKey("2026-09-15T17:30:00Z"), "2026-09-16");
  assert.equal(localISO("2024-02-29"), "2024-02-28T17:00:00.000Z");
});
