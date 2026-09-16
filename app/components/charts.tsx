"use client";
import { useState } from "react";
import { fmt } from "../libs/electricity";
export interface Point {
  label: string;
  value: number | null;
  detail?: string;
  id?: string;
}
export function Chart({
  points,
  unit = "kWh",
  bars = false,
  secondary = [],
  secondaryLabel = "ค่าเฉลี่ยเคลื่อนที่",
  onPoint,
}: {
  points: Point[];
  unit?: string;
  bars?: boolean;
  secondary?: Point[];
  secondaryLabel?: string;
  onPoint?: (p: Point) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!points.length)
    return <div className="chart-empty">ยังไม่มีช่วงข้อมูลให้วาดกราฟ</div>;
  // Limit SVG density, while the selectable data table retains every point.
  const stride = Math.max(1, Math.ceil(points.length / 180)),
    shown = points
      .map((p, i) => ({ ...p, index: i }))
      .filter((_, i) => i % stride === 0 || i === points.length - 1);
  const values = [...points, ...secondary].flatMap((p) =>
      p.value === null ? [] : [p.value],
    ),
    min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    range = max - min || 1;
  const x = (i: number) => 56 + (i / Math.max(points.length - 1, 1)) * 660,
    y = (v: number) => 216 - ((v - min) / range) * 180;
  const path = (data: Point[]) =>
    data
      .map((p, i) =>
        p.value === null
          ? ""
          : `${i === 0 || data[i - 1].value === null ? "M" : "L"}${x(i)},${y(p.value)}`,
      )
      .join(" ");
  const point = selected === null ? null : points[selected];
  return (
    <div className="chart-wrap">
      <div className="chart-unit">
        {unit}
        {secondary.length > 0 && <span>● {secondaryLabel}</span>}
      </div>
      <svg
        viewBox="0 0 744 256"
        className="data-chart"
        role="img"
        aria-label={`กราฟ ${unit} ${points.length} จุด มีตารางข้อมูลด้านล่าง`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1="56"
              x2="720"
              y1={y(min + t * range)}
              y2={y(min + t * range)}
              stroke="#ded8d9"
              strokeDasharray="4 5"
            />
            <text x="46" y={y(min + t * range) + 4} textAnchor="end">
              {fmt(min + t * range, 1)}
            </text>
          </g>
        ))}
        {!bars && (
          <path
            d={shown
              .map((p, i) =>
                p.value === null
                  ? ""
                  : `${i === 0 || shown[i - 1].value === null ? "M" : "L"}${x(p.index)},${y(p.value)}`,
              )
              .join(" ")}
            fill="none"
            stroke="#e60067"
            strokeWidth="3"
          />
        )}
        {secondary.length > 0 && (
          <path
            d={path(secondary)}
            fill="none"
            stroke="#151515"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />
        )}
        {shown.map((p) =>
          p.value === null ? null : (
            <g
              key={p.index}
              onClick={() => {
                setSelected(p.index);
                onPoint?.(p);
              }}
            >
              {bars ? (
                <rect
                  x={x(p.index) - Math.min(20, 260 / shown.length)}
                  y={y(Math.max(0, p.value))}
                  width={Math.min(40, 520 / shown.length)}
                  height={Math.max(2, Math.abs(y(p.value) - y(0)))}
                  fill={p.index === selected ? "#ffe600" : "#e60067"}
                  stroke="#111"
                  strokeWidth="1.5"
                />
              ) : (
                <circle
                  cx={x(p.index)}
                  cy={y(p.value)}
                  r={p.index === selected ? 6 : 3.5}
                  fill={p.index === selected ? "#ffe600" : "white"}
                  stroke="#111"
                  strokeWidth="1.5"
                />
              )}
              <circle cx={x(p.index)} cy={y(p.value)} r="13" fill="transparent">
                <title>
                  {p.label}: {fmt(p.value)} {unit} {p.detail}
                </title>
              </circle>
            </g>
          ),
        )}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1]
          .filter((n, i, a) => a.indexOf(n) === i)
          .map((i) => (
            <text
              key={i}
              x={x(i)}
              y="246"
              textAnchor={
                i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
              }
            >
              {points[i].label}
            </text>
          ))}
      </svg>
      <label className="chart-select">
        สำรวจจุดข้อมูล
        <select
          aria-label="สำรวจจุดข้อมูล"
          value={selected ?? ""}
          onChange={(e) => {
            const i = Number(e.target.value);
            setSelected(i);
            onPoint?.(points[i]);
          }}
        >
          <option value="" disabled>
            เลือกวัน / ช่วงเวลา
          </option>
          {points.map((p, i) => (
            <option key={i} value={i}>
              {p.label} · {fmt(p.value)} {unit}
            </option>
          ))}
        </select>
      </label>
      {point && (
        <div className="chart-detail" aria-live="polite">
          <b>
            {point.label} · {fmt(point.value)} {unit}
          </b>
          <span>{point.detail}</span>
          {point.id && (
            <a className="text-link" href={`/?edit=${point.id}`}>
              เปิดรายการต้นทาง ↗
            </a>
          )}
        </div>
      )}
      <details className="chart-table">
        <summary>
          ดูตารางข้อมูล {points.length} จุด
          {stride > 1 ? " · กราฟลดจุดเพื่อความลื่นไหล" : ""}
        </summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ช่วงเวลา</th>
                <th>{unit}</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i}>
                  <td>{p.label}</td>
                  <td>{fmt(p.value)}</td>
                  <td>{p.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
export function BoxPlot({
  min,
  q1,
  median,
  q3,
  max,
}: {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}) {
  const x = (v: number) => 40 + ((v - min) / (max - min || 1)) * 630;
  return (
    <div className="box-plot">
      <svg
        viewBox="0 0 710 85"
        role="img"
        aria-label={`Box plot min ${min}, Q1 ${q1}, median ${median}, Q3 ${q3}, max ${max}`}
      >
        <line
          x1={x(min)}
          x2={x(max)}
          y1="28"
          y2="28"
          stroke="black"
          strokeWidth="2"
        />
        <rect
          x={x(q1)}
          y="12"
          width={Math.max(1, x(q3) - x(q1))}
          height="32"
          fill="#ffe600"
          stroke="black"
          strokeWidth="2"
        />
        {[min, median, max].map((v, i) => (
          <line
            key={i}
            x1={x(v)}
            x2={x(v)}
            y1="7"
            y2="49"
            stroke={i === 1 ? "#e60067" : "black"}
            strokeWidth="3"
          />
        ))}
        {[min, q1, median, q3, max].map((v, i) => (
          <text key={i} x={40 + i * 157.5} y="73" textAnchor="middle">
            {["min", "Q1", "median", "Q3", "max"][i]} {fmt(v)}
          </text>
        ))}
      </svg>
      <p className="muted">
        กล่อง Q1–Q3 · เส้นชมพู median · ปลายเส้น min/max (รวม outliers)
      </p>
    </div>
  );
}
