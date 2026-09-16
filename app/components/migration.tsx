"use client";
import { useState } from "react";
import {
  request,
  type KafaiRecord,
  type MigrationInput,
  type MigrationPreview,
} from "../libs/api";
import {
  dateLabel,
  fmt,
  localInput,
  localISO,
  meter,
} from "../libs/electricity";
import { Notice } from "./ui";
export default function Migration({
  records,
  onSaved,
}: {
  records: KafaiRecord[];
  onSaved: () => void;
}) {
  const legacy = records
    .filter((r) => r.recordType !== "meter_reading")
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  const [anchor, setAnchor] = useState(""),
    [start, setStart] = useState(""),
    [preview, setPreview] = useState<MigrationPreview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [migrationId, setMigrationId] = useState("");
  const last = legacy.at(-1),
    readings = records.some((r) => r.recordType === "meter_reading");
  const payload = (): MigrationInput => ({
    startAt: localISO(start),
    anchorAt: last!.recordedAt,
    anchorReading: Number(anchor),
    modulus: 10000,
    fingerprint: JSON.stringify(
      records.map((r) => `${r._id}:${r.updatedAt || ""}`).sort(),
    ),
  });
  async function action(commit = false) {
    setBusy(true);
    setError("");
    try {
      if (commit) {
        const r = await request<{ migrationId: string }>(
          "/kafai/migration/commit",
          "POST",
          payload(),
        );
        setMigrationId(r.migrationId);
        setPreview(null);
        onSaved();
      } else
        setPreview(
          await request<MigrationPreview>(
            "/kafai/migration/preview",
            "POST",
            payload(),
          ),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function rollback() {
    setBusy(true);
    setError("");
    try {
      let id = migrationId;
      if (!id) {
        const latest = await request<{ _id: string; status: string } | null>(
          "/kafai/migration/latest",
        );
        if (!latest || latest.status !== "applied")
          throw new Error("ไม่มีการแปลงที่ย้อนกลับได้");
        id = latest._id;
      }
      await request("/kafai/migration/rollback", "POST", { migrationId: id });
      setMigrationId("");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!legacy.length && !records.some((r) => r.source === "reconstructed"))
    return null;
  return (
    <details className="migration-panel">
      <summary>
        ประวัติรูปแบบเดิม ·{" "}
        {legacy.length ? `${legacy.length} รายการ` : "แปลงเป็นเลขสะสมแล้ว"}{" "}
        <span>ดู / แปลง / ย้อนกลับ</span>
      </summary>
      <div className="migration-body">
        {error && <Notice error>{error}</Notice>}
        {last && (
          <>
            <p>
              หน่วยเดิมยังอยู่ครบ รวม{" "}
              <b>{fmt(legacy.reduce((s, r) => s + (r.unit || 0), 0))} kWh</b>{" "}
              แยกจากผลต่างมิเตอร์ใหม่เพื่อไม่ให้นับซ้ำ
            </p>
            <p className="muted">
              ย้อนสร้างเลขสะสมจากเลขที่ทราบ ณ {dateLabel(last.recordedAt, true)}{" "}
              หากรู้แค่เลขวันนี้แต่ประวัติสิ้นสุดก่อนวันนี้
              ให้เริ่มบันทึกเลขวันนี้แยกชุด ไม่ย้อนเดาช่วงที่ขาด
            </p>
            {legacy.some((r) => r.dateChanged) && (
              <Notice>
                บางรายการเคยใช้วันที่เป้าหมายต่างจากวันที่บันทึก
                หลังแปลงจะจัดกลุ่มตามวันที่บันทึก ค่าดิบเก่าเก็บในสำเนาสำรอง
              </Notice>
            )}
            {!readings && (
              <>
                <div className="form-grid">
                  <label className="field">
                    เวลาเริ่มช่วงของหน่วยรายการแรก
                    <input
                      type="datetime-local"
                      value={start}
                      max={localInput(legacy[0].recordedAt)}
                      onChange={(e) => {
                        setStart(e.target.value);
                        setPreview(null);
                      }}
                    />
                  </label>
                  <label className="field">
                    เลขมิเตอร์ ณ ปลายประวัติ
                    <input
                      type="number"
                      min="0"
                      max="9999.999999"
                      step="0.000001"
                      value={anchor}
                      onChange={(e) => {
                        setAnchor(e.target.value);
                        setPreview(null);
                      }}
                      placeholder="เลขอ้างอิงที่ทราบจริง"
                    />
                  </label>
                </div>
                <p className="muted">
                  ถือว่าหน่วยเก่าแต่ละรายการคือปริมาณใช้ถึงวันที่บันทึกนั้น
                  ต้องทราบเวลาเริ่มต้นจริง/ประมาณและประวัติต่อเนื่องครบ
                </p>
                <button
                  className="button button-light"
                  disabled={busy || !start || anchor === ""}
                  onClick={() => action()}
                >
                  ดูผลก่อนแปลง
                </button>
              </>
            )}
            {preview && (
              <div className="migration-preview">
                <Notice>{preview.warning}</Notice>
                <p>
                  <b>
                    {preview.count} รายการ · ยอดคงเดิม {fmt(preview.total)} kWh
                  </b>
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>เวลา</th>
                        <th>เลขสะสม</th>
                        <th>รอบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.entries.map((r, i) => (
                        <tr key={i}>
                          <td>{dateLabel(r.recordedAt, true)}</td>
                          <td>{meter(r.meterReading)}</td>
                          <td>{r.cycle}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="button button-pink"
                  disabled={busy}
                  onClick={() => action(true)}
                >
                  ใช้ผลแปลงนี้ พร้อมเก็บสำเนาต้นฉบับ
                </button>
              </div>
            )}
          </>
        )}
        {(migrationId || records.some((r) => r.source === "reconstructed")) && (
          <>
            <p className="muted">
              ย้อนกลับได้หากยังไม่มีการแก้/เพิ่ม/ลบหลังแปลง
              เพื่อไม่ทับข้อมูลใหม่
            </p>
            <button
              disabled={busy}
              className="button button-light"
              onClick={rollback}
            >
              ย้อนกลับการแปลงล่าสุด
            </button>
          </>
        )}
      </div>
    </details>
  );
}
