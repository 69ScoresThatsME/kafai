"use client";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import {
  Shell,
  Panel,
  Metric,
  Notice,
  Loading,
  Rate,
  ExportButton,
  DetailLink,
  useRecords,
} from "../components/ui";
import { BoxPlot, Chart } from "../components/charts";
import {
  absolute,
  aggregate,
  buildIntervals,
  clipIntervals,
  dailyBuckets,
  DAY,
  dayKey,
  downloadCSV,
  fmt,
  localISO,
  movingAverage,
  type Bucket,
} from "../libs/electricity";
import {
  describe,
  diagnostics,
  forecast,
  histogram,
  weightedRate,
} from "../libs/statistics";

export default function Statistics() {
  const data = useRecords(),
    [preset, setPreset] = useState("all"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [source, setSource] = useState("all"),
    [grain, setGrain] = useState<"day" | "week" | "month">("day"),
    [variable, setVariable] = useState<"daily" | "kwh">("daily"),
    [unwrapped, setUnwrapped] = useState(false),
    [sort, setSort] = useState("date"),
    [search, setSearch] = useState(""),
    [heatMonth, setHeatMonth] = useState(() => dayKey(Date.now()).slice(0, 7));
  const engine = useMemo(() => buildIntervals(data.records), [data.records]);
  const [now] = useState(() => Date.now());
  const [limit, setLimit] = useState(15);
  const today = dayKey(now),
    nowEnd = Date.parse(localISO(today)) + DAY;
  const from =
    preset === "custom" && start
      ? Date.parse(localISO(start))
      : preset === "all"
        ? -Infinity
        : nowEnd - Number(preset) * DAY;
  const to =
    preset === "custom" && end ? Date.parse(localISO(end)) + DAY : nowEnd;
  const filtered = engine.intervals.filter(
    (i) => source === "all" || source === i.source,
  );
  const intervals = clipIntervals(filtered, from, to),
    buckets = dailyBuckets(intervals),
    groups = aggregate(buckets, grain),
    monthly = aggregate(buckets, "month");
  const total = intervals.reduce((s, i) => s + i.kwh, 0),
    covered = intervals.reduce((s, i) => s + i.days, 0),
    daily = weightedRate(intervals);
  const dist = describe(intervals.map((i) => i[variable])),
    bins = histogram(intervals.map((i) => i[variable]));
  const monthCosts = monthly.map((b) => b.kwh * data.rate),
    monthStats = describe(monthCosts);
  const maximum = monthly.find((b) => b.kwh * data.rate === monthStats.max),
    minimum = monthly.find((b) => b.kwh * data.rate === monthStats.min);
  const currentMonth = today.slice(0, 7),
    mStart = Date.parse(localISO(`${currentMonth}-01`));
  const mEnd = Date.parse(
    localISO(
      new Date(
        Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1),
      )
        .toISOString()
        .slice(0, 10),
    ),
  );
  const current = clipIntervals(filtered, mStart, now),
    currentTotal = current.reduce((s, i) => s + i.kwh, 0),
    currentRate = weightedRate(current),
    latestEnd = Math.max(mStart, ...current.map((i) => i.end)),
    remaining = Math.max(0, (mEnd - latestEnd) / DAY);
  const proj =
    currentRate === null ? null : currentTotal + currentRate * remaining;
  const boundsStart = Number.isFinite(from)
      ? from
      : Math.min(...intervals.map((i) => i.start)),
    boundsEnd = Math.min(to, Math.max(...intervals.map((i) => i.end)));
  const prev =
    Number.isFinite(boundsStart) && boundsEnd > boundsStart
      ? clipIntervals(
          filtered,
          boundsStart - (boundsEnd - boundsStart),
          boundsStart,
        )
      : [];
  const prevRate = weightedRate(prev),
    change =
      daily !== null && prevRate !== null && prevRate !== 0
        ? ((daily - prevRate) / prevRate) * 100
        : null;
  const diag = diagnostics(buckets),
    prediction = forecast(buckets, 7);
  const legacy = engine.legacy.filter(
    (r) => Date.parse(r.recordedAt) >= from && Date.parse(r.recordedAt) < to,
  );
  const legacyMonths = aggregate(
    legacy.map((r) => ({
      key: dayKey(r.recordedAt),
      kwh: r.unit || 0,
      days: 0,
      estimated: false,
      ids: [r._id],
      reconstructed: false,
    })),
    "month",
  );
  const points = groups.map((b) => ({
    label: b.key,
    value: b.kwh,
    detail: `${b.estimated ? "จัดสรรตามเวลา · " : ""}${b.reconstructed ? "มีข้อมูลย้อนสร้าง · " : ""}${fmt(b.days, 1)} วัน · ${fmt(b.kwh * data.rate)} บาท`,
    id: b.ids[0],
  }));
  const ma = movingAverage(buckets, 7),
    ma30 = movingAverage(buckets, 30);
  const shownReadings = engine.readings.filter(
    (r) =>
      Date.parse(r.recordedAt) >= from &&
      Date.parse(r.recordedAt) < to &&
      (source === "all" || r.source === source),
  );
  const heatStart = Date.parse(localISO(`${heatMonth}-01`)),
    heatDays = new Date(
      Number(heatMonth.slice(0, 4)),
      Number(heatMonth.slice(5, 7)),
      0,
    ).getDate(),
    heatMax = Math.max(
      1,
      ...buckets.filter((b) => b.key.startsWith(heatMonth)).map((b) => b.kwh),
    );
  const rows = [...intervals]
    .filter((i) =>
      `${dayKey(i.start)} ${dayKey(i.end)} ${i.source}`.includes(search),
    )
    .sort((a, b) =>
      sort === "usage"
        ? b.kwh - a.kwh
        : sort === "daily"
          ? b.daily - a.daily
          : b.end - a.end,
    );
  const complete = (b: Bucket) =>
    Math.abs(
      b.days -
        new Date(
          Number(b.key.slice(0, 4)),
          Number(b.key.slice(5, 7)),
          0,
        ).getDate(),
    ) < 1e-5;
  function exportData() {
    downloadCSV("kafai-analysis.csv", [
      [
        "timezone",
        "Asia/Bangkok",
        "rate",
        data.rate,
        "source",
        source,
        "from",
        Number.isFinite(from) ? new Date(from).toISOString() : "all",
        "to",
        new Date(to).toISOString(),
      ],
      [
        "method",
        "interval difference including cycles; calendar allocation assumes constant rate; cost = allocated kWh * rate",
      ],
      [
        "month",
        "kwh",
        "estimatedBaht",
        "coveredDays",
        "completeMonth",
        "allocated",
        "reconstructed",
      ],
      ...monthly.map((b) => [
        b.key,
        b.kwh,
        b.kwh * data.rate,
        b.days,
        complete(b),
        b.estimated,
        b.reconstructed,
      ]),
      [],
      [
        "intervalId",
        "start",
        "end",
        "kwh",
        "days",
        "kwhPerDay",
        "estimatedBaht",
        "source",
        "rollover",
      ],
      ...intervals.map((i) => [
        i.id,
        new Date(i.start).toISOString(),
        new Date(i.end).toISOString(),
        i.kwh,
        i.days,
        i.daily,
        i.kwh * data.rate,
        i.source,
        i.rollover,
      ]),
      [],
      ["recordId", "recordedAt", "meterReading", "cycle", "modulus", "source"],
      ...shownReadings.map((r) => [
        r._id,
        r.recordedAt,
        r.meterReading,
        r.cycle,
        r.modulus,
        r.source,
      ]),
      [],
      ["legacyId", "recordedAt", "legacyUsageKwh"],
      ...legacy.map((r) => [r._id, r.recordedAt, r.unit]),
    ]);
  }
  return (
    <Shell analytics>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ENERGY INTELLIGENCE / สถิติการใช้ไฟ</p>
          <h1>
            อ่านพลังงาน<span className="pink">ให้ลึกขึ้น.</span>
          </h1>
          <p className="muted">
            ค่าไฟรายเดือน แนวโน้ม และความแปรปรวน — จากข้อมูลของคุณ
          </p>
        </div>
        <ExportButton onClick={exportData} />
      </div>
      {data.error && (
        <Notice error>
          {data.error}{" "}
          <button onClick={data.load} className="text-link">
            ลองใหม่
          </button>
        </Notice>
      )}
      <div className="filter-bar">
        <div className="segmented">
          {[
            ["all", "ทั้งหมด"],
            ["7", "7 วัน"],
            ["30", "30 วัน"],
            ["90", "90 วัน"],
            ["custom", "กำหนดเอง"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={preset === v ? "active" : ""}
              onClick={() => setPreset(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="inline-field">
          แหล่งข้อมูล
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">ทุกช่วงมิเตอร์</option>
            <option value="measured">วัดจริง</option>
            <option value="reconstructed">คำนวณย้อนหลัง</option>
          </select>
        </label>
        {preset === "custom" && (
          <div className="date-range">
            <label className="field">
              ตั้งแต่
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="field">
              ถึง
              <input
                type="date"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>
      {from >= to && <Notice error>วันเริ่มต้องไม่เกินวันสิ้นสุด</Notice>}
      {data.loading ? (
        <Loading />
      ) : (
        <>
          <div className="metrics-grid">
            <Metric
              label="ค่าไฟเฉลี่ยต่อเดือน"
              value={fmt(monthStats.mean)}
              unit="บาท"
              accent
              note={`${monthly.length} เดือนที่มีข้อมูลในช่วงเลือก`}
            />
            <Metric
              label="เดือนที่ค่าไฟสูงสุด"
              value={fmt(monthStats.max)}
              unit="บาท"
              note={
                maximum
                  ? `${maximum.key} · ${complete(maximum) ? "ครบเดือน" : "ข้อมูลบางส่วน"}`
                  : "ยังไม่มีข้อมูล"
              }
            />
            <Metric
              label="เดือนที่ค่าไฟต่ำสุด"
              value={fmt(monthStats.min)}
              unit="บาท"
              note={
                minimum
                  ? `${minimum.key} · ${complete(minimum) ? "ครบเดือน" : "ข้อมูลบางส่วน"}`
                  : "ยังไม่มีข้อมูล"
              }
            />
            <Metric
              label="ค่าไฟเฉลี่ยต่อวัน"
              value={daily === null ? "—" : fmt(daily * data.rate)}
              unit="บาท/วัน"
              note={`${fmt(daily)} kWh/วัน · ถ่วงตามเวลา`}
            />
          </div>
          <Rate rate={data.rate} onChange={data.changeRate} />
          <Panel
            title="แต่ละเดือน จ่ายเท่าไหร่?"
            eyebrow="01 / MONTHLY ELECTRICITY COST"
            action={<span className="tag tag-yellow">บาท / เดือน</span>}
          >
            <p className="muted">
              ยอดประมาณแยกเดือน ไม่ใช่ค่าไฟสะสม ·
              ค่าเฉลี่ย/สูงสุด/ต่ำสุดข้างบนใช้เดือนที่มีข้อมูลในช่วงเลือก
              รวมเดือนบางส่วน
            </p>
            <Chart
              bars
              unit="บาท"
              points={monthly.map((b) => ({
                label: b.key,
                value: b.kwh * data.rate,
                detail: `${fmt(b.kwh)} kWh · ${complete(b) ? "ครบเดือน" : "ข้อมูลไม่ครบเดือน"} · ${b.estimated ? "จัดสรรตามเวลา" : "รวมช่วงวัด"}${b.reconstructed ? " · มีประวัติย้อนสร้าง" : ""}`,
              }))}
            />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>เดือน</th>
                    <th>ค่าไฟประมาณ</th>
                    <th>หน่วยใช้ไฟ</th>
                    <th>บาท/วัน</th>
                    <th>วันมีข้อมูล</th>
                    <th>คุณภาพข้อมูล</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((b) => (
                    <tr key={b.key}>
                      <td>
                        <b>{b.key}</b>
                      </td>
                      <td className="pink">
                        <b>{fmt(b.kwh * data.rate)} ฿</b>
                      </td>
                      <td>{fmt(b.kwh)} kWh</td>
                      <td>{fmt((b.kwh / b.days) * data.rate)}</td>
                      <td>{fmt(b.days, 1)}</td>
                      <td>
                        <span className="tag">
                          {complete(b) ? "ครบเดือน" : "บางส่วน"}
                        </span>
                        {b.estimated && " · จัดสรร"}
                        {b.reconstructed && " · ย้อนสร้าง"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {legacyMonths.length > 0 && (
              <details className="legacy-cost">
                <summary>ค่าไฟจากประวัติเดิม · แสดงแยกเพื่อไม่บวกซ้ำ</summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>เดือนตามวันที่บันทึก</th>
                        <th>หน่วยเดิม</th>
                        <th>ค่าไฟประมาณ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legacyMonths.map((b) => (
                        <tr key={b.key}>
                          <td>{b.key}</td>
                          <td>{fmt(b.kwh)}</td>
                          <td>{fmt(b.kwh * data.rate)} ฿</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">
                  ไม่รวมใน KPI มิเตอร์ด้านบน
                  เพราะยังไม่ทราบช่วงเวลาที่ซ้อนกันหรือข้อมูลเชื่อมครบ
                </p>
              </details>
            )}
          </Panel>
          <div className="analysis-grid">
            <Panel
              title="แนวโน้มการใช้ไฟ"
              eyebrow="02 / CONSUMPTION"
              action={
                <select
                  aria-label="ระดับการรวมข้อมูล"
                  value={grain}
                  onChange={(e) => setGrain(e.target.value as typeof grain)}
                >
                  <option value="day">รายวัน</option>
                  <option value="week">รายสัปดาห์</option>
                  <option value="month">รายเดือน</option>
                </select>
              }
            >
              <Chart
                points={points}
                secondary={
                  grain === "day"
                    ? ma.map((p) => ({ label: p.key, value: p.value }))
                    : []
                }
                secondaryLabel="เฉลี่ย 7 วัน (kWh/วัน)"
              />
              <p className="muted">
                เส้นเฉลี่ยถ่วงตามเวลาที่มีข้อมูล ไม่เติมวันที่หายเป็นศูนย์
              </p>
              <details>
                <summary>ค่าเฉลี่ยเคลื่อนที่ 30 วัน</summary>
                <Chart
                  unit="kWh/วัน"
                  points={ma30.map((p) => ({ label: p.key, value: p.value }))}
                />
              </details>
            </Panel>
            <Panel title="คุณภาพและภาพรวม" eyebrow="DATA CONTEXT">
              <div className="quality-number">
                {intervals.length}
                <span>ช่วงการวัด</span>
              </div>
              <dl className="facts">
                <div>
                  <dt>เวลาที่มีข้อมูล</dt>
                  <dd>{fmt(covered, 1)} วัน</dd>
                </div>
                <div>
                  <dt>ใช้ไฟในช่วงเลือก</dt>
                  <dd>{fmt(total)} kWh</dd>
                </div>
                <div>
                  <dt>ค่าเฉลี่ยถ่วงเวลา</dt>
                  <dd>{fmt(daily)} kWh/วัน</dd>
                </div>
                <div>
                  <dt>ช่วงที่ผิดปกติ / ตัดออก</dt>
                  <dd>{engine.invalid.length}</dd>
                </div>
                <div>
                  <dt>วันที่จัดสรรโดยประมาณ</dt>
                  <dd>
                    {buckets.filter((b) => b.estimated).length} /{" "}
                    {buckets.length}
                  </dd>
                </div>
                <div>
                  <dt>ข้อมูลล่าสุด</dt>
                  <dd>
                    {engine.readings.length
                      ? dayKey(engine.readings.at(-1)!.recordedAt)
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="insight">
                <Info size={18} />
                <p>
                  {change === null ? (
                    "ยังไม่มีช่วงก่อนหน้าที่เทียบอัตราการใช้ไฟได้"
                  ) : (
                    <>
                      ค่าเฉลี่ยต่อวัน{" "}
                      {change >= 0 ? (
                        <ArrowUpRight size={15} />
                      ) : (
                        <ArrowDownRight size={15} />
                      )}{" "}
                      <b>{fmt(Math.abs(change))}%</b>{" "}
                      {change >= 0 ? "สูงขึ้น" : "ลดลง"}{" "}
                      เทียบหน้าต่างก่อนหน้าที่ยาวเท่ากัน (มีข้อมูล{" "}
                      {fmt(
                        prev.reduce((s, i) => s + i.days, 0),
                        1,
                      )}{" "}
                      วัน)
                    </>
                  )}
                </p>
              </div>
              <p className="muted">
                Coverage บอกเวลาที่คำนวณได้ ไม่ได้หมายความว่ามีการวัดรายวันจริง
              </p>
            </Panel>
          </div>
          <Panel
            title="เลขมิเตอร์ตามเวลา"
            eyebrow="METER HISTORY"
            action={
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={unwrapped}
                  onChange={(e) => setUnwrapped(e.target.checked)}
                />
                รวมรอบหน้าปัด
              </label>
            }
          >
            <Chart
              unit={unwrapped ? "kWh สะสมรวมรอบ" : "เลขหน้าปัด"}
              points={shownReadings.map((r) => ({
                label: dayKey(r.recordedAt),
                value: unwrapped ? absolute(r) : (r.meterReading ?? null),
                detail: `${r.source === "reconstructed" ? "คำนวณย้อนหลัง" : "วัดจริง"} · รอบ ${r.cycle || 0}`,
                id: r._id,
              }))}
            />
            <p className="muted">
              เลขหน้าปัดลดลงเมื่อวนครบ 10000 ไม่ใช่ใช้ไฟติดลบ
              สลับรวมรอบเพื่อดูเส้นต่อเนื่อง
            </p>
          </Panel>
          <div className="analysis-grid">
            <Panel
              title="การกระจายของการใช้ไฟ"
              eyebrow="03 / DISTRIBUTION"
              action={
                <select
                  aria-label="ตัวแปรวิเคราะห์"
                  value={variable}
                  onChange={(e) =>
                    setVariable(e.target.value as typeof variable)
                  }
                >
                  <option value="daily">kWh/วัน ต่อช่วงอ่าน</option>
                  <option value="kwh">kWh ต่อช่วงอ่าน</option>
                </select>
              }
            >
              <Chart
                bars
                unit="จำนวนช่วง"
                points={bins.map((b) => ({
                  label: `${fmt(b.low, 1)}–${fmt(b.high, 1)}`,
                  value: b.count,
                  detail: "Sturges bins · ช่วงสุดท้ายรวมขอบขวา",
                }))}
              />
              {dist.n > 0 && (
                <BoxPlot
                  min={dist.min!}
                  max={dist.max!}
                  q1={dist.q1!}
                  q3={dist.q3!}
                  median={dist.median!}
                />
              )}
              <p className="muted">
                หนึ่ง observation = หนึ่งช่วงอ่าน ให้น้ำหนักแต่ละช่วงเท่ากัน ·{" "}
                {dist.outliers.length} outliers ตามกฎ 1.5×IQR (ยังเก็บไว้)
              </p>
            </Panel>
            <Panel title="สถิติเชิงพรรณนา" eyebrow="DESCRIPTIVE STATISTICS">
              <div className="stat-grid">
                {Object.entries({
                  n: dist.n,
                  Missing: dist.missing,
                  Mean: dist.mean,
                  Median: dist.median,
                  Min: dist.min,
                  Max: dist.max,
                  Q1: dist.q1,
                  Q3: dist.q3,
                  IQR: dist.iqr,
                  P90: dist.p90,
                  P95: dist.p95,
                  "Sample variance": dist.variance,
                  SD: dist.sd,
                  "CV (%)": dist.cv,
                  MAD: dist.mad,
                }).map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <b>{fmt(v)}</b>
                  </div>
                ))}
              </div>
              <p className="muted">
                หน่วย {variable === "daily" ? "kWh/วัน" : "kWh/ช่วง"} · variance
                มีหน่วยยกกำลังสอง · SD ใช้ n−1 · quantile ใช้ linear
                interpolation (type 7)
              </p>
            </Panel>
          </div>
          <Panel
            title="ปฏิทินความเข้มการใช้ไฟ"
            eyebrow="04 / ENERGY HEATMAP"
            action={
              <input
                aria-label="เดือน heatmap"
                type="month"
                value={heatMonth}
                onChange={(e) => {
                  if (e.target.value) setHeatMonth(e.target.value);
                }}
              />
            }
          >
            <div className="heatmap">
              {Array.from({ length: heatDays }, (_, i) => {
                const key = dayKey(heatStart + i * DAY),
                  b = buckets.find((v) => v.key === key);
                return (
                  <button
                    key={key}
                    style={
                      b
                        ? {
                            background: `rgba(230,0,103,${0.08 + (b.kwh / heatMax) * 0.7})`,
                          }
                        : undefined
                    }
                    className={b ? "" : "missing"}
                    title={`${key}: ${b ? fmt(b.kwh) + " kWh" : "ไม่มีข้อมูล"}`}
                    onClick={() => setSearch(search === key ? "" : key)}
                  >
                    <b>{i + 1}</b>
                    <span>{b ? fmt(b.kwh, 1) : "—"}</span>
                    <small>{b?.estimated ? "≈ kWh" : "kWh"}</small>
                  </button>
                );
              })}
            </div>
            <p className="muted">
              — ไม่มีข้อมูล · 0 ใช้ไฟศูนย์จริง · ≈ จัดสรรจากช่วงหลายวัน ·
              แตะวันเพื่อกรองตารางช่วงการวัด
            </p>
          </Panel>
          <div className="analysis-grid">
            <Panel
              title="แนวโน้มและรูปแบบรายสัปดาห์"
              eyebrow="05 / TIME-SERIES DIAGNOSTICS"
            >
              {diag ? (
                <>
                  <p>
                    แนวโน้มเชิงเส้น <b>{fmt(diag.slope, 3)} kWh/วัน ต่อวัน</b>{" "}
                    จาก {diag.valid.length} วันต่อเนื่อง ไม่อ้างนัยสำคัญทางสถิติ
                  </p>
                  <Chart
                    bars
                    unit="kWh/วัน"
                    points={diag.weekdays.map((d) => ({
                      label: [
                        "อาทิตย์",
                        "จันทร์",
                        "อังคาร",
                        "พุธ",
                        "พฤหัส",
                        "ศุกร์",
                        "เสาร์",
                      ][d.day],
                      value: d.value,
                      detail: `n=${d.n} วันจริง`,
                    }))}
                  />
                  <details>
                    <summary>Residuals และ residual ACF</summary>
                    <Chart
                      unit="residual kWh"
                      points={diag.residuals.map((v, i) => ({
                        label: diag.valid[i].key,
                        value: v,
                      }))}
                    />
                    <Chart
                      bars
                      unit="autocorrelation"
                      points={diag.acf.map((p) => ({
                        label: `lag ${p.lag}`,
                        value: p.value,
                      }))}
                    />
                  </details>
                </>
              ) : (
                <div className="method-note">
                  <Info />
                  <h3>ยังแยกรูปแบบวันในสัปดาห์ไม่ได้</h3>
                  <p>
                    ต้องมีอย่างน้อย 28 วันเต็มที่วัดจริงต่อเนื่อง
                    ข้อมูลที่เกลี่ยจากหลายวันหรือคำนวณย้อนหลังไม่ใช้สรุปพฤติกรรมรายวัน
                  </p>
                </div>
              )}
            </Panel>
            <Panel title="มองค่าไฟข้างหน้า" eyebrow="06 / FORECAST">
              <div className="projection">
                <span>ประมาณการสิ้นเดือน {currentMonth}</span>
                <strong>
                  {proj === null ? "—" : fmt(proj * data.rate)}{" "}
                  <small>บาท</small>
                </strong>
                <p>
                  ใช้ข้อมูลเดือนปัจจุบันถึง{" "}
                  {current.length ? dayKey(latestEnd) : "—"}{" "}
                  ไม่ขึ้นกับตัวกรองช่วงวันที่ด้านบน
                </p>
              </div>
              <p className="muted">
                Scenario: ยอดที่ทราบ {fmt(currentTotal * data.rate)} บาท +
                อัตราเฉลี่ยปัจจุบัน × อีก {fmt(remaining, 1)} วัน
                ไม่ใช่ยอดบิลหรือช่วงความเชื่อมั่น
              </p>
              {prediction ? (
                <>
                  <p>
                    <b>อีก 7 วัน: {fmt(prediction.total)} kWh</b> · โมเดล{" "}
                    {prediction.model}
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>โมเดล</th>
                          <th>MAE</th>
                          <th>RMSE</th>
                          <th>Folds</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prediction.scores.map((s) => (
                          <tr key={s.model}>
                            <td>{s.model}</td>
                            <td>{fmt(s.mae)}</td>
                            <td>{fmt(s.rmse)}</td>
                            <td>{s.folds}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted">
                    Rolling-origin horizon 7 วัน ไม่มี random split; เลือก MAE
                    ต่ำสุด ผล backtest ใช้เลือกโมเดล ยังไม่ใช่ผลทดสอบอิสระ
                  </p>
                  {prediction.range ? (
                    <p>
                      ช่วง error เชิงประจักษ์ P10–P90 ของยอด 7 วัน:{" "}
                      {fmt(prediction.range[0])}–{fmt(prediction.range[1])} kWh
                      (ยังไม่รับรอง coverage อนาคต)
                    </p>
                  ) : (
                    <p className="muted">
                      ยังไม่มี 20 folds สำหรับแสดงช่วง error ของยอดรวม
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">
                  Forecast ที่ผ่าน backtest ต้องมีวันจริงต่อเนื่องอย่างน้อย 42
                  วัน ขณะนี้แสดงได้เฉพาะ scenario ตามสมมติฐานข้างต้น
                </p>
              )}
            </Panel>
          </div>
          <Panel
            title="ตรวจสอบทุกช่วงการวัด"
            eyebrow="AUDITABLE DATA"
            action={
              <select
                aria-label="เรียงช่วงข้อมูล"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="date">ล่าสุดก่อน</option>
                <option value="usage">หน่วยมากก่อน</option>
                <option value="daily">อัตราต่อวันมากก่อน</option>
              </select>
            }
          >
            <label className="field">
              ค้นหาวัน / แหล่งข้อมูล
              <input
                placeholder="เช่น 2026-09-16"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ต้นช่วง → ปลายช่วง</th>
                    <th>kWh</th>
                    <th>วัน</th>
                    <th>kWh/วัน</th>
                    <th>บาท</th>
                    <th>แหล่งข้อมูล</th>
                    <th>รายการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((i) => (
                    <tr key={i.id}>
                      <td>
                        {dayKey(i.start)} → {dayKey(i.end)}
                      </td>
                      <td>{fmt(i.kwh)}</td>
                      <td>{fmt(i.days)}</td>
                      <td>{fmt(i.daily)}</td>
                      <td>{fmt(i.kwh * data.rate)}</td>
                      <td>
                        {i.source === "measured" ? "วัดจริง" : "ย้อนสร้าง"}
                        {i.rollover ? " · วนรอบ" : ""}
                      </td>
                      <td>
                        <DetailLink id={i.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          {rows.length > limit && <button className="button button-light" onClick={() => setLimit(limit + 15)}>ดูช่วงการวัดเพิ่มเติม · แสดง {limit} จาก {rows.length}</button>}
          <details className="methods">
            <summary>
              <Info size={18} /> วิธีคำนวณ สมมติฐาน และข้อจำกัด
            </summary>
            <div>
              <p>
                ผลต่าง = เลขใหม่ − เลขก่อน + ผลต่างรอบ × modulus; baseline
                ไม่ใช่ observation ศูนย์ ช่วงที่ filter
                ตัดกลางใช้จัดสรรตามเวลาภายใต้สมมติฐานอัตราคงที่
              </p>
              <p>
                เฉลี่ยต่อวัน = ΣkWh ÷ Σวันมีข้อมูล
                ค่ากระจายให้แต่ละช่วงอ่านน้ำหนักเท่ากัน
                จึงต่างจากค่าเฉลี่ยถ่วงเวลา Missing ไม่ถูกแทนด้วยศูนย์;
                ช่วงต่างชุดมิเตอร์ที่ซ้อนกันควรตรวจสอบก่อนตีความค่าเฉลี่ย
              </p>
              <p>
                เดือนที่ขาดข้อมูลและเดือนปัจจุบันไม่ใช่ยอดเต็มเดือน ค่าไฟทุกช่อง
                = kWh × อัตราที่ตั้ง ไม่ใช่หลักฐานชำระเงิน
                การเปลี่ยนอัตราคำนวณประวัติใหม่ทั้งหมด
              </p>
              <p>
                IQR fences = Q1−1.5IQR ถึง Q3+1.5IQR; MAD = median(|x−median|);
                CV = SD/mean×100 เมื่อmeanไม่เป็น0; n&lt;2ไม่มีsample SD
                ไม่มีการลบ outlier อัตโนมัติ
              </p>
              <p>
                ไม่สร้าง p-value หรือ CI แบบ iid สำหรับอนุกรมเวลา
                ไม่มีการอ้างสาเหตุจากอุปกรณ์/สภาพอากาศที่ไม่ได้เก็บ ค่า
                projection ไม่ใช่ statistical prediction interval
              </p>
              <p>
                เวลาแบ่งวัน Asia/Bangkok ช่วง [start,end) ตัวเลขดิบไม่ปัดก่อนรวม
                CSV มีข้อมูลต้นทาง/ช่วง/สูตรสำหรับตรวจซ้ำ
              </p>
            </div>
          </details>
        </>
      )}
    </Shell>
  );
}
