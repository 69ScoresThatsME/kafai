"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Download,
  LogOut,
  Zap,
} from "lucide-react";
import { accountKey, getRecords, type KafaiRecord } from "../libs/api";
import { fmt } from "../libs/electricity";
export function useRecords() {
  const router = useRouter();
  const [records, setRecords] = useState<KafaiRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [rate, setRate] = useState(4),
    [loadedAt, setLoadedAt] = useState<string>("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(await getRecords());
      setLoadedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    const expired = () => router.replace('/login');
    window.addEventListener('kafai:unauthorized', expired);
    const key = `ratePerUnit:${accountKey()}`;
    let old = localStorage.getItem(key);
    if (old === null && !localStorage.getItem("rateMigrationOwner")) {
      old = localStorage.getItem("ratePerUnit");
      localStorage.setItem("rateMigrationOwner", accountKey());
      if (old !== null) localStorage.setItem(key, old);
    }
    const value = old === null ? 4 : Number(old);
    getRecords()
      .then((data) => {
        if (active) {
          setRecords(data);
          setLoadedAt(new Date().toISOString());
          setRate(Number.isFinite(value) && value >= 0 ? value : 4);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener('kafai:unauthorized', expired);
    };
  }, [router]);
  function changeRate(value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    setRate(value);
    localStorage.setItem(`ratePerUnit:${accountKey()}`, String(value));
  }
  return {
    records,
    loading,
    error,
    setError,
    load,
    rate,
    changeRate,
    loadedAt,
  };
}
export function Shell({
  children,
  analytics = false,
}: {
  children: ReactNode;
  analytics?: boolean;
}) {
  const router = useRouter();
  return (
    <main className="min-h-screen persona-bg app-shell">
      <a href="#content" className="skip-link">
        ข้ามไปเนื้อหา
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <Zap fill="currentColor" size={22} />
            </span>
            KAFAI<span className="brand-caption">YOUR ENERGY, DECODED.</span>
          </Link>
          <nav aria-label="เมนูหลัก">
            <Link className={!analytics ? "nav-active" : ""} href="/">
              <Activity size={17} />
              บันทึกมิเตอร์
            </Link>
            <Link className={analytics ? "nav-active" : ""} href="/statist">
              <BarChart3 size={17} />
              สถิติ
            </Link>
            <button
              aria-label="ออกจากระบบ"
              onClick={() => {
                localStorage.removeItem("token");
                router.replace("/login");
              }}
            >
              <LogOut size={18} />
            </button>
          </nav>
        </div>
      </header>
      <div id="content" className="app-content">
        {children}
        <footer className="app-footer">
          <b>KAFAI / KNOW YOUR ENERGY.</b>
          <span>เวลาไทย · kWh = หน่วยไฟ · ค่าใช้จ่ายเป็นค่าประมาณ</span>
        </footer>
      </div>
    </main>
  );
}
export function Panel({
  title,
  eyebrow,
  children,
  action,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="section-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Metric({
  label,
  value,
  unit,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className={`metric ${accent ? "metric-accent" : ""}`}>
      <span className="metric-label">{label}</span>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      {note && <p>{note}</p>}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <Zap size={30} />
      <p>กำลังอ่านข้อมูลพลังงานของคุณ…</p>
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state">
      <Activity size={34} />
      <p>{children}</p>
    </div>
  );
}
export function Rate({
  rate,
  onChange,
}: {
  rate: number;
  onChange: (n: number) => void;
}) {
  return (
    <details className="rate-setting">
      <summary>
        อัตราค่าไฟ <b>{fmt(rate)} ฿/kWh</b>
      </summary>
      <label className="field">
        บาทต่อหน่วย
        <input
          aria-label="อัตราค่าไฟ"
          type="number"
          min="0"
          step="0.01"
          defaultValue={rate}
          key={rate}
          onBlur={(e) => {
            if (
              e.target.value.trim() &&
              Number.isFinite(Number(e.target.value))
            )
              onChange(Number(e.target.value));
            else e.target.value = String(rate);
          }}
        />
      </label>
      <p className="muted">
        ใช้คำนวณทุกเดือนด้วยอัตรานี้ ยังไม่รวมค่าบริการหรือภาษี
        ไม่ใช่ยอดชำระจริง
      </p>
    </details>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current,
      previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="app-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="ปิด">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="button button-light" onClick={onClick}>
      <Download size={16} />
      CSV
    </button>
  );
}
export function DetailLink({ id }: { id: string }) {
  return (
    <Link className="text-link" href={`/?edit=${id}`}>
      ดูรายการ <ArrowUpRight size={14} />
    </Link>
  );
}
