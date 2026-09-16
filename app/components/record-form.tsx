"use client";
import { useState, type FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { saveRecord, type KafaiRecord } from "../libs/api";
import {
  absolute,
  dateLabel,
  fmt,
  localInput,
  localISO,
  meter,
} from "../libs/electricity";
import { Notice } from "./ui";
export default function RecordForm({
  records,
  record,
  onSaved,
}: {
  records: KafaiRecord[];
  record?: KafaiRecord;
  onSaved: () => void;
}) {
  const [at, setAt] = useState(localInput(record?.recordedAt)),
    [value, setValue] = useState(
      record ? String(record.meterReading ?? record.unit ?? "") : "",
    ),
    [cycle, setCycle] = useState(""),
    [reset, setReset] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const legacy = !!record && record.recordType !== "meter_reading";
  const sorted = records
    .filter((r) => r.recordType === "meter_reading" && r._id !== record?._id)
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  const series = record?.seriesId || sorted.at(-1)?.seriesId || "main";
  const prev = sorted
      .filter((r) => r.seriesId === series && r.recordedAt < localISO(at))
      .at(-1),
    next = sorted.find(
      (r) => r.seriesId === series && r.recordedAt > localISO(at),
    );
  const modulus = record?.modulus ?? prev?.modulus ?? next?.modulus ?? 10000;
  const inferred = reset
    ? 0
    : (record?.cycle ??
      (prev
        ? (prev.cycle || 0) + (Number(value) < prev.meterReading! ? 1 : 0)
        : next
          ? (next.cycle || 0) - (Number(value) > next.meterReading! ? 1 : 0)
          : 0));
  const actualCycle = cycle === "" ? inferred : Number(cycle),
    diff =
      prev && !reset
        ? Number(value) + actualCycle * modulus - absolute(prev)
        : null,
    rollover = value.trim() !== '' && !!prev && !reset && actualCycle !== prev.cycle;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError("");
    try {
      await saveRecord(
        {
          recordedAt: localISO(at),
          ...(legacy
            ? { unit: Number(value) }
            : {
                meterReading: Number(value),
                modulus,
                cycle: actualCycle,
                seriesId: reset ? `meter_${Date.now()}` : series,
                confirmRollover: confirmed,
              }),
          updatedAt: record?.updatedAt,
        },
        record?._id,
      );
      setValue("");
      setConfirmed(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="record-form">
      {error && <Notice error>{error}</Notice>}
      <div className="form-grid">
        <label className="field">
          วันที่ / เวลาอ่านมิเตอร์ <span>เวลาไทย</span>
          <input
            aria-label="วันที่และเวลาอ่านมิเตอร์"
            type="datetime-local"
            value={at}
            onChange={(e) => {
              if (e.target.value) setAt(e.target.value);
            }}
            required
          />
        </label>
        <label className="field">
          {legacy ? "หน่วยใช้ไฟเดิม (kWh)" : "เลขมิเตอร์ปัจจุบัน"}
          <div className="meter-input">
            <input
              aria-label={legacy ? "หน่วยใช้ไฟเดิม" : "เลขมิเตอร์ปัจจุบัน"}
              inputMode="decimal"
              type="number"
              min="0"
              max={legacy ? undefined : modulus - 0.000001}
              step="0.000001"
              value={value}
              placeholder="เช่น 6564"
              onChange={(e) => {
                setValue(e.target.value);
                setConfirmed(false);
              }}
              required
            />
            <span>{legacy ? "kWh" : "kWh สะสม"}</span>
          </div>
        </label>
      </div>
      {!legacy && (
        <div className="reading-preview">
          <span>
            {prev && !reset
              ? `ครั้งก่อน ${meter(prev.meterReading)} · ${dateLabel(prev.recordedAt, true)}`
              : "จุดเริ่มต้นของการติดตาม"}
          </span>
          <strong>
            {value !== "" && diff !== null
              ? `${fmt(diff)} kWh เพิ่มขึ้น`
              : "ครั้งแรกเป็นค่าตั้งต้น ไม่คิดเป็นหน่วยที่ใช้"}
          </strong>
          {diff !== null && diff < 0 && (
            <p className="error-text">
              เลขรวมรอบน้อยกว่าครั้งก่อน ตรวจเลขหรือจำนวนรอบ
            </p>
          )}
        </div>
      )}
      {rollover && (
        <label className="check-field">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          ตรวจสอบแล้ว: มิเตอร์วนรอบจริง ผลต่าง {fmt(diff)} kWh
          ไม่ใช่เลขที่พิมพ์ผิด
        </label>
      )}
      {!legacy && (
        <details>
          <summary className="muted">มิเตอร์วนหลายรอบ / เปลี่ยนมิเตอร์</summary>
          <div className="advanced-form">
            {!record && (
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={reset}
                  onChange={(e) => {
                    setReset(e.target.checked);
                    setCycle("");
                  }}
                />
                เปลี่ยนมิเตอร์ เริ่มชุดใหม่
              </label>
            )}
            <label className="field">
              จำนวนรอบสะสม (ค่าอัตโนมัติ {inferred})
              <input
                aria-label="จำนวนรอบสะสม"
                type="number"
                step="1"
                value={cycle}
                placeholder={String(inferred)}
                onChange={(e) => {
                  setCycle(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            <p className="muted">
              หน้าปัดวนทุก {fmt(modulus, 0)} หน่วย ·
              ค่าอัตโนมัติสมมติว่าใช้ไม่เกินหนึ่งรอบระหว่างจด
              หากเว้นนานจนวนหลายรอบ ให้ระบุรอบที่ทราบ
            </p>
          </div>
        </details>
      )}
      {record && (
        <p className="muted">
          การแก้ไขคำนวณช่วงก่อนและหลังใหม่ โดยรักษาจำนวนรอบสะสมของรายการอื่น
        </p>
      )}
      <button
        disabled={busy || (rollover && !confirmed)}
        className="button button-pink submit-reading"
      >
        {record ? <Save size={19} /> : <Plus size={19} />}{" "}
        {busy ? "กำลังบันทึก…" : record ? "บันทึกการแก้ไข" : "บันทึกเลขมิเตอร์"}
      </button>
      {record?.source === "reconstructed" && (
        <p className="muted">
          นี่คือเลขคำนวณย้อนหลัง การแก้จะเปลี่ยนผลต่างช่วงข้างเคียง
          แต่ไม่ย้ายเลขของรายการอื่น สำเนาก่อนแปลงยังเก็บไว้
        </p>
      )}
    </form>
  );
}
