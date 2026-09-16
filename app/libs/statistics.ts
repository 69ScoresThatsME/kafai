import { DAY, type Bucket, type Interval } from "./electricity";
export const mean = (xs: number[]) =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
export function quantile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b),
    h = (s.length - 1) * p,
    i = Math.floor(h);
  return s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (h - i);
}
export function describe(values: number[]) {
  const xs = values.filter(Number.isFinite),
    n = xs.length,
    average = mean(xs),
    median = quantile(xs, 0.5),
    q1 = quantile(xs, 0.25),
    q3 = quantile(xs, 0.75);
  const variance =
      n > 1 ? xs.reduce((s, x) => s + (x - average!) ** 2, 0) / (n - 1) : null,
    sd = variance === null ? null : Math.sqrt(variance),
    iqr = q1 === null || q3 === null ? null : q3 - q1;
  return {
    n,
    missing: values.length - n,
    sum: n ? xs.reduce((s, x) => s + x, 0) : null,
    mean: average,
    median,
    min: n ? Math.min(...xs) : null,
    max: n ? Math.max(...xs) : null,
    q1,
    q3,
    iqr,
    p90: quantile(xs, 0.9),
    p95: quantile(xs, 0.95),
    variance,
    sd,
    cv: average && sd !== null ? (sd / average) * 100 : null,
    mad:
      median === null
        ? null
        : quantile(
            xs.map((x) => Math.abs(x - median)),
            0.5,
          ),
    outliers:
      iqr === null
        ? []
        : xs.filter((x) => x < q1! - 1.5 * iqr || x > q3! + 1.5 * iqr),
  };
}
export function histogram(xs: number[]) {
  if (!xs.length) return [];
  const lo = Math.min(...xs),
    hi = Math.max(...xs),
    n = Math.min(20, Math.max(1, Math.ceil(Math.log2(xs.length) + 1))),
    width = hi === lo ? 1 : (hi - lo) / n;
  const bins = Array.from({ length: hi === lo ? 1 : n }, (_, i) => ({
    low: lo + i * width,
    high: lo + (i + 1) * width,
    count: 0,
  }));
  xs.forEach(
    (x) =>
      bins[Math.min(bins.length - 1, Math.floor((x - lo) / width))].count++,
  );
  return bins;
}
export function diagnostics(buckets: Bucket[]) {
  // Only genuine, complete daily observations. Allocated days never count as new observations.
  const valid = buckets.filter(
    (b) => !b.estimated && !b.reconstructed && Math.abs(b.days - 1) < 1e-6,
  );
  if (
    valid.length < 28 ||
    valid.some(
      (b, i) =>
        i > 0 && Date.parse(b.key) - Date.parse(valid[i - 1].key) !== DAY,
    )
  )
    return null;
  const ys = valid.map((b) => b.kwh),
    n = ys.length,
    xbar = (n - 1) / 2,
    ybar = mean(ys)!;
  const slope =
    ys.reduce((s, y, i) => s + (i - xbar) * (y - ybar), 0) /
    ys.reduce((s, _, i) => s + (i - xbar) ** 2, 0);
  const residuals = ys.map((y, i) => y - (ybar + slope * (i - xbar))),
    ss = residuals.reduce((s, r) => s + r * r, 0);
  const acf = Array.from(
    { length: Math.min(14, Math.floor(n / 4)) },
    (_, j) => ({
      lag: j + 1,
      value: ss
        ? residuals.slice(j + 1).reduce((s, r, i) => s + r * residuals[i], 0) /
          ss
        : 0,
    }),
  );
  const weekdays = Array.from({ length: 7 }, (_, d) => {
    const sample = valid
      .filter((b) => new Date(b.key).getUTCDay() === d)
      .map((b) => b.kwh);
    return { day: d, n: sample.length, value: mean(sample) };
  });
  return { slope, residuals, acf, weekdays, valid };
}
type Model = "naive" | "mean7" | "seasonal7";
function predict(xs: number[], model: Model, horizon: number) {
  return Array.from({ length: horizon }, (_, i) =>
    model === "naive"
      ? xs.at(-1)!
      : model === "mean7"
        ? mean(xs.slice(-7))!
        : xs[xs.length - 7 + (i % 7)],
  );
}
export function forecast(buckets: Bucket[], horizon = 7) {
  const d = diagnostics(buckets);
  if (!d || d.valid.length < 42) return null;
  const xs = d.valid.map((b) => b.kwh),
    models: Model[] = ["naive", "mean7", "seasonal7"];
  const scores = models.map((model) => {
    const errors: number[] = [],
      sums: number[] = [];
    for (let t = 28; t + horizon <= xs.length; t += horizon) {
      const p = predict(xs.slice(0, t), model, horizon),
        e = p.map((v, j) => xs[t + j] - v);
      errors.push(...e);
      sums.push(e.reduce((s, x) => s + x, 0));
    }
    return {
      model,
      folds: sums.length,
      mae: mean(errors.map(Math.abs)),
      rmse: errors.length ? Math.sqrt(mean(errors.map((e) => e * e))!) : null,
      sums,
    };
  });
  const winner = [...scores].sort(
    (a, b) => (a.mae ?? Infinity) - (b.mae ?? Infinity),
  )[0];
  if (winner.folds < 2) return null;
  const prediction = predict(xs, winner.model, horizon),
    total = prediction.reduce((s, x) => s + x, 0);
  // Empirical horizon-total error quantiles preserve within-horizon dependence.
  // A descriptive range, not a calibrated confidence/prediction claim with few folds.
  const range =
    winner.folds >= 20
      ? [
          Math.max(0, total + quantile(winner.sums, 0.1)!),
          Math.max(0, total + quantile(winner.sums, 0.9)!),
        ]
      : null;
  return {
    model: winner.model,
    prediction,
    total,
    scores,
    folds: winner.folds,
    range,
  };
}
export function weightedRate(intervals: Interval[]) {
  const days = intervals.reduce((s, i) => s + i.days, 0);
  return days ? intervals.reduce((s, i) => s + i.kwh, 0) / days : null;
}
