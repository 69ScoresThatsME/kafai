# Kafai electricity workspace

The existing structure.md describes the original app. This document records the September 2026 meter/analytics implementation while preserving local edits to that guide.

The Persona palette, heavy borders, hard shadows, diagonal background, Geist typography and existing auth screens remain. `/` now has a cumulative meter form with interval preview, explicit rollover confirmation, replacement-meter support, edit/delete dialogs, calendar/list history and monthly-only consumption/cost cards. `/statist` provides monthly baht summaries and averages/extremes, time/source filters, daily/weekly/monthly graphs, moving averages, cumulative/raw meter views, histogram, box plot, heatmap, interval audit table and CSV export.

## Files

- `app/libs/api.ts`: v2 header, JWT request client, error handling and account keys.
- `app/libs/electricity.ts`: Bangkok dates, meter intervals, clipping/allocation, aggregation and export.
- `app/libs/statistics.ts`: type-7 quantiles, sample variance/SD, MAD/CV, IQR flags, actual-daily diagnostics and rolling-origin baseline comparisons.
- `app/components`: shared frames/metrics, accessible dialog, SVG charts with selectable data/table alternatives, meter form and legacy migration UI.
- `tests/calculations.test.ts`: independent arithmetic fixtures.
- `tests/e2e/dashboard.spec.ts`: browser CRUD and layouts; API is mocked for repeatability.

All period summaries derive from the same interval layer. Cost = period kWh × rate; displayed monthly amounts reset each calendar month. No cumulative meter value is multiplied into a bill. Missing periods are not zero. Baselines contribute no statistical observation. Cross-day intervals are allocated proportionally and marked estimated. Reconstructed history remains labeled and excluded from actual-daily inference. Month averages/extremes include partial months and are labeled accordingly; complete-day rates use elapsed time rather than record count.

Meter difference uses stored cycles. `9999 → 0000` with a cycle increment is 1 kWh. Cycles survive intermediate deletions. New records have only reading time and cumulative number as main inputs, with no target date. Legacy records remain separately visible/editable until migrated. The numeric electricity rate is scoped to the JWT account in localStorage, with a one-time import of the old browser setting.

## Statistical limits

Each distribution observation is one interval (unweighted interval descriptive statistics); headline daily mean is time-weighted. Clipped/multi-day allocation is not treated as independently measured daily data. Weekday, linear residual and ACF diagnostics require 28 consecutive complete measured days; forecast comparisons require 42 and at least two nonoverlapping rolling-origin 7-day folds. Naive, trailing-7 mean and seasonal-7 are compared by MAE/RMSE. The displayed empirical error range after 20 folds is explicitly not a calibrated prediction interval. Month-end amounts are scenarios under the observed daily rate, not paid bills, iid confidence intervals or causal claims.

`Asia/Bangkok` is used for calendar boundaries and formatting; UTC timestamps are sent to the API. Rate changes recalculate displayed historical estimates; no Ft, tax, tiered tariff or actual-payment field is invented.

## Development and verification

Use `NEXT_PUBLIC_API_URL=http://localhost:5000/api` in an ignored `.env.local` for local API integration. `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` are available. Browser tests use a local Next server on 3100 and produce screenshots under ignored `test-results/`. Widths: 360, 390, 412, 768, 1366, 1920 CSS px. This is Chromium emulation, not a claim of testing on a physical TECNO handset. No production fixtures or credentials are committed.
