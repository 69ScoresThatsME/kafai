"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Pencil,
  Trash2,
  Zap,
} from "lucide-react";
import { deleteRecord, type KafaiRecord } from "./libs/api";
import {
  buildIntervals,
  clipIntervals,
  dailyBuckets,
  dateLabel,
  dayKey,
  DAY,
  downloadCSV,
  fmt,
  localISO,
  meter,
} from "./libs/electricity";
import {
  Shell,
  Panel,
  Metric,
  Notice,
  Loading,
  Empty,
  Rate,
  Modal,
  ExportButton,
  useRecords,
} from "./components/ui";
import RecordForm from "./components/record-form";
import Migration from "./components/migration";
import { Chart } from "./components/charts";

export default function Home() {
  const data = useRecords(),
    [month, setMonth] = useState(() => dayKey(Date.now()).slice(0, 7)),
    [view, setView] = useState<"list" | "calendar">("list"),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<KafaiRecord | null>(null),
    [deleting, setDeleting] = useState<KafaiRecord | null>(null),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  const { readings, intervals, legacy, invalid } = buildIntervals(data.records),
    latest = readings.at(-1);
  const from = Date.parse(localISO(`${month}-01`)),
    to = Date.parse(
      localISO(
        new Date(
          Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1),
        )
          .toISOString()
          .slice(0, 10),
      ),
    ),
    days = (to - from) / DAY;
  const clipped = clipIntervals(intervals, from, to),
    buckets = dailyBuckets(clipped),
    units = clipped.reduce((s, i) => s + i.kwh, 0),
    covered = clipped.reduce((s, i) => s + i.days, 0);
  const monthRecords = data.records.filter(
    (r) =>
      dayKey(r.recordedAt).startsWith(month) &&
      (!selected || dayKey(r.recordedAt) === selected),
  );
  const sorted = [...monthRecords].sort(
    (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
  );
  const intervalMap = new Map(intervals.map((i) => [i.id, i]));
  const [closedRequested, setClosedRequested] = useState(false);
  const [limit, setLimit] = useState(10);
  const requested =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("edit");
  const activeEdit =
    editing ||
    (!closedRequested && data.records.find((r) => r._id === requested)) ||
    null;
  function closeEdit() {
    setEditing(null);
    setClosedRequested(true);
    if (requested) window.history.replaceState(null, "", "/");
  }
  function shift(n: number) {
    const d = new Date(from + 7 * 3600000);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
    setSelected(null);
  }
  function saved() {
    closeEdit();
    setSuccess("บันทึกแล้ว · คำนวณยอดรายเดือนใหม่เรียบร้อย");
    void data.load();
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteRecord(deleting);
      setDeleting(null);
      setSuccess("ลบรายการแล้ว และคำนวณช่วงข้างเคียงใหม่");
      await data.load();
    } catch (e) {
      data.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportRecords() {
    downloadCSV(`kafai-${month}.csv`, [
      ["timezone", "Asia/Bangkok", "rate", data.rate],
      [
        "recordedAt",
        "recordType",
        "meterReading",
        "cycle",
        "modulus",
        "legacyKwh",
        "intervalKwh",
        "source",
      ],
      ...monthRecords.map((r) => [
        r.recordedAt,
        r.recordType,
        r.meterReading,
        r.cycle,
        r.modulus,
        r.unit,
        intervalMap.get(r._id)?.kwh,
        r.source,
      ]),
    ]);
  }
  return (
    <Shell>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <span className="live-dot" /> ELECTRICITY LOG / บันทึกพลังงาน
          </p>
          <h1>
            รู้ทุกหน่วย<span className="pink">ที่ใช้ไป.</span>
          </h1>
          <p className="muted">
            จดเลขบนมิเตอร์ แล้วให้ตัวเลขเล่าเรื่องการใช้ไฟของคุณ
          </p>
        </div>
        <Link href="/statist" className="button button-yellow">
          วิเคราะห์การใช้ไฟ <ArrowUpRight size={18} />
        </Link>
      </div>
      {data.error && (
        <Notice error>
          {data.error}{" "}
          <button className="text-link" onClick={data.load}>
            ลองใหม่
          </button>
        </Notice>
      )}
      {success && <Notice>{success}</Notice>}
      {data.loading ? (
        <Loading />
      ) : (
        <>
          <div className="overview-grid">
            <section className="meter-hero">
              <div className="section-heading">
                <span className="tag tag-yellow">
                  <Zap size={14} /> LIVE METER
                </span>
                <span className="hero-small">เลขหน้าปัดล่าสุด</span>
              </div>
              <div className="meter-digits">{meter(latest?.meterReading)}</div>
              <div className="hero-bottom">
                <span>kWh สะสมบนมิเตอร์</span>
                <span>
                  {latest
                    ? dateLabel(latest.recordedAt, true)
                    : "ยังไม่มีค่าตั้งต้น"}
                </span>
              </div>
              <p>เลขนี้ไม่ใช่ยอดใช้ไฟ · คำนวณการใช้จากผลต่างแต่ละครั้ง</p>
            </section>
            <Panel
              title={readings.length ? "จดครั้งถัดไป" : "เริ่มจดมิเตอร์"}
              eyebrow="01 / RECORD"
            >
              <RecordForm records={data.records} onSaved={saved} />
            </Panel>
          </div>
          <Migration records={data.records} onSaved={saved} />
          {invalid.length > 0 && (
            <Notice error>
              พบ {invalid.length} ช่วงที่เวลา/เลขผิดลำดับ ไม่นำมาคำนวณ
              กรุณาตรวจรายการ
            </Notice>
          )}
          <div className="month-toolbar">
            <div>
              <p className="eyebrow">02 / YOUR MONTH</p>
              <h2>ค่าไฟเดือนนี้ ไม่ปนเดือนอื่น</h2>
            </div>
            <div className="month-controls">
              <button
                className="icon-button"
                onClick={() => shift(-1)}
                aria-label="เดือนก่อน"
              >
                <ChevronLeft />
              </button>
              <input
                aria-label="เดือนที่แสดง"
                type="month"
                value={month}
                onChange={(e) => {
                  if (e.target.value) {
                    setMonth(e.target.value);
                    setSelected(null);
                  }
                }}
              />
              <button
                className="icon-button"
                onClick={() => shift(1)}
                aria-label="เดือนถัดไป"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
          <div className="metrics-grid">
            <Metric
              label={`ค่าไฟประมาณ · ${month}`}
              value={covered ? fmt(units * data.rate) : "—"}
              unit="บาท"
              accent
              note="เฉพาะเดือนที่เลือก · ไม่สะสมข้ามเดือน"
            />
            <Metric
              label="ใช้ไฟในเดือนนี้"
              value={covered ? fmt(units) : "—"}
              unit="kWh"
              note={`${fmt(covered, 1)} จาก ${days} วันมีช่วงข้อมูล`}
            />
            <Metric
              label="ใช้เฉลี่ยต่อวัน"
              value={covered ? fmt(units / covered) : "—"}
              unit="kWh/วัน"
              note="หน่วยที่ใช้ ÷ เวลาที่มีข้อมูล"
            />
            <Metric
              label="เฉลี่ยค่าไฟต่อวัน"
              value={covered ? fmt((units / covered) * data.rate) : "—"}
              unit="บาท/วัน"
              note="คำนวณจากอัตราค่าไฟที่ตั้งไว้"
            />
          </div>
          <Rate rate={data.rate} onChange={data.changeRate} />
          <Panel
            title="จังหวะการใช้ไฟ"
            eyebrow="DAILY CONSUMPTION"
            action={
              <Link className="text-link" href="/statist">
                วิเคราะห์ละเอียด <ArrowUpRight size={16} />
              </Link>
            }
          >
            <Chart
              points={buckets.map((b) => ({
                label: b.key,
                value: b.kwh,
                detail: b.estimated
                  ? "จัดสรรตามเวลาจากช่วงมิเตอร์"
                  : "ข้อมูลเต็มวัน",
                id: b.ids[0],
              }))}
              bars
            />
            <p className="muted">
              ช่วงที่คร่อมวันกระจายตามเวลาโดยสมมติอัตราคงที่
              วันที่ไม่มีข้อมูลไม่ใช่ใช้ไฟ 0
            </p>
          </Panel>
          <Panel
            title="ประวัติการจด"
            eyebrow="03 / READINGS"
            action={
              <div className="button-group">
                <button
                  className={`icon-button ${view === "list" ? "selected" : ""}`}
                  aria-label="แสดงรายการ"
                  onClick={() => setView("list")}
                >
                  <List size={19} />
                </button>
                <button
                  className={`icon-button ${view === "calendar" ? "selected" : ""}`}
                  aria-label="แสดงปฏิทิน"
                  onClick={() => setView("calendar")}
                >
                  <CalendarDays size={19} />
                </button>
                <ExportButton onClick={exportRecords} />
              </div>
            }
          >
            {view === "calendar" && (
              <>
                <div className="calendar-grid">
                  {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
                    <span className="calendar-weekday" key={d}>
                      {d}
                    </span>
                  ))}
                  {Array.from(
                    { length: new Date(`${month}-01T00:00:00Z`).getUTCDay() },
                    (_, i) => (
                      <span key={`empty${i}`} />
                    ),
                  )}
                  {Array.from({ length: days }, (_, i) => {
                    const key = `${month}-${String(i + 1).padStart(2, "0")}`,
                      b = buckets.find((x) => x.key === key),
                      n = data.records.filter(
                        (r) => dayKey(r.recordedAt) === key,
                      ).length;
                    return (
                      <button
                        aria-label={`${key} ${n} รายการ`}
                        key={key}
                        className={`calendar-cell ${selected === key ? "selected" : ""} ${n ? "has-reading" : ""}`}
                        onClick={() =>
                          setSelected(selected === key ? null : key)
                        }
                      >
                        <b>{i + 1}</b>
                        <span>{b ? `${fmt(b.kwh, 1)}` : "—"}</span>
                        <small>{n ? n + " จด" : "kWh"}</small>
                      </button>
                    );
                  })}
                </div>
                <p className="muted">
                  แตะวันเพื่อดูทุกรายการ · {selected || "แสดงทั้งหมดในเดือน"}
                </p>
              </>
            )}
            {!sorted.length ? (
              <Empty>
                {readings.length === 1
                  ? "มีค่าตั้งต้นแล้ว จดครั้งถัดไปเพื่อดูหน่วยที่ใช้"
                  : "ไม่มีรายการในช่วงที่เลือก"}
              </Empty>
            ) : (
              <div className="records-list">
                {sorted.slice(0, limit).map((r) => {
                  const i = intervalMap.get(r._id),
                    old = r.recordType !== "meter_reading";
                  return (
                    <article className="record-row" key={r._id}>
                      <div className="record-date">
                        <b>{dateLabel(r.recordedAt)}</b>
                        <span>
                          {dateLabel(r.recordedAt, true).split(" ").at(-1)} ·{" "}
                          {old
                            ? "ข้อมูลเดิม"
                            : r.source === "reconstructed"
                              ? "คำนวณย้อนหลัง"
                              : i?.rollover
                                ? "วนหน้าปัด"
                                : "อ่านมิเตอร์"}
                        </span>
                      </div>
                      <div>
                        <span className="small-label">
                          {old ? "หน่วยเดิม" : "เลขสะสม"}
                        </span>
                        <strong className="record-value">
                          {old ? fmt(r.unit) : meter(r.meterReading)}
                        </strong>
                      </div>
                      <div>
                        <span className="small-label">
                          {old ? "ยังไม่แปลง" : "ใช้ในช่วง"}
                        </span>
                        <strong>
                          {old ? "—" : i ? `${fmt(i.kwh)} kWh` : "ค่าตั้งต้น"}
                        </strong>
                      </div>
                      <div className="record-actions">
                        <button
                          className="icon-button"
                          aria-label={`แก้ไข ${r._id}`}
                          onClick={() => setEditing(r)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`ลบ ${r._id}`}
                          onClick={() => setDeleting(r)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {sorted.length > limit && <button className="button button-light" onClick={() => setLimit(limit + 10)}>ดูอีก {Math.min(10, sorted.length - limit)} รายการ · ทั้งหมด {sorted.length}</button>}
            {legacy.length > 0 && (
              <p className="muted">
                ข้อมูลเดิมแสดงแยก ไม่บวกซ้ำกับผลต่างมิเตอร์ใหม่
                ดูยอดเดิมรายเดือนได้ที่หน้าสถิติ
              </p>
            )}
          </Panel>
        </>
      )}
      {activeEdit && (
        <Modal title="แก้ไขรายการ" onClose={closeEdit}>
          <RecordForm
            records={data.records}
            record={activeEdit}
            onSaved={saved}
          />
        </Modal>
      )}
      {deleting && (
        <Modal title="ลบรายการนี้?" onClose={() => setDeleting(null)}>
          <p>
            เลข {meter(deleting.meterReading ?? deleting.unit)} ·{" "}
            {dateLabel(deleting.recordedAt, true)}
          </p>
          <p className="muted">
            ช่วงก่อนและหลังจะคำนวณใหม่โดยรักษารอบมิเตอร์
            หากลบค่าตั้งต้นจะไม่ทราบการใช้ไฟช่วงแรกอีก
          </p>
          <div className="dialog-actions">
            <button
              className="button button-light"
              onClick={() => setDeleting(null)}
            >
              ยกเลิก
            </button>
            <button
              className="button button-pink"
              disabled={busy}
              onClick={remove}
            >
              {busy ? "กำลังลบ…" : "ลบรายการ"}
            </button>
          </div>
        </Modal>
      )}
    </Shell>
  );
}
