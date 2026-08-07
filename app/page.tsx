"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  KafaiRecord,
  getKafaiListApi,
  addKafaiApi,
  updateKafaiApi,
  deleteKafaiApi,
} from "./libs/api";

export default function ElectricSchedulePage() {
  const router = useRouter();

  // State
  const [records, setRecords] = useState<KafaiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Rate multiplier (persisted in localStorage)
  const [ratePerUnit, setRatePerUnit] = useState<number>(4);

  // View Mode: 'calendar' | 'table' | 'card'
  const [viewMode, setViewMode] = useState<"calendar" | "table" | "card">("calendar");

  // Selected Month & Year state for Calendar Navigation
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1); // 1 - 12

  // Load ratePerUnit from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRate = localStorage.getItem("ratePerUnit");
      if (savedRate && !isNaN(Number(savedRate))) {
        setRatePerUnit(parseFloat(savedRate));
      }
    }
  }, []);

  // Save ratePerUnit to localStorage when updated
  const handleRateChange = (newRate: number) => {
    setRatePerUnit(newRate);
    if (typeof window !== "undefined") {
      localStorage.setItem("ratePerUnit", newRate.toString());
    }
  };

  // Form State (Add)
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().split("T")[0]);
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split("T")[0]);
  const [unit, setUnit] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Edit State
  const [editingRecord, setEditingRecord] = useState<KafaiRecord | null>(null);
  const [editRecordedAt, setEditRecordedAt] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editUnit, setEditUnit] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  // Auth Guard & Initial Fetch
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchRecords();
  }, [router]);

  const fetchRecords = async () => {
    setLoading(true);
    setError("");
    const res = await getKafaiListApi();

    if (res.status === 401) {
      localStorage.removeItem("token");
      router.push("/login");
      return;
    }

    if (res.error) {
      setError(res.error);
    } else if (res.data) {
      setRecords(res.data);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  // Month Navigation
  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const selectedMonthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  // Month Date Range details
  const monthInfo = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...

    const monthName = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const formatShort = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    return {
      monthName,
      firstDayStr: formatShort(firstDay),
      lastDayStr: formatShort(lastDay),
      daysInMonth,
      startDayOfWeek,
    };
  }, [currentYear, currentMonth]);

  // Group Records by Date (YYYY-MM-DD)
  const recordsByDateMap = useMemo(() => {
    const map: { [dateStr: string]: KafaiRecord[] } = {};

    records.forEach((r) => {
      const rawDate = r.targetDate || r.recordedAt;
      if (!rawDate) return;
      const dateStr = rawDate.split("T")[0];
      if (!map[dateStr]) {
        map[dateStr] = [];
      }
      map[dateStr].push(r);
    });

    return map;
  }, [records]);

  // Filtered records for selected month
  const monthlyRecords = useMemo(() => {
    return records.filter((r) => {
      const rawDate = r.targetDate || r.recordedAt;
      if (!rawDate) return false;
      return rawDate.startsWith(selectedMonthKey);
    });
  }, [records, selectedMonthKey]);

  // Month Totals
  const monthUnits = monthlyRecords.reduce((acc, r) => acc + (Number(r.unit) || 0), 0);
  const monthCost = monthUnits * ratePerUnit;

  // Overall Totals
  const totalUnitsOverall = records.reduce((acc, r) => acc + (Number(r.unit) || 0), 0);
  const totalCostOverall = totalUnitsOverall * ratePerUnit;

  // Add Record Handler
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit || isNaN(Number(unit))) {
      setError("Please enter a valid numeric electric unit value");
      return;
    }

    setError("");
    setSuccess("");
    setSubmitting(true);

    const res = await addKafaiApi({
      recordedAt,
      targetDate,
      unit: parseFloat(unit),
    });

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Record added successfully!");
      setUnit("");
      fetchRecords();
      setTimeout(() => setSuccess(""), 3000);
    }
    setSubmitting(false);
  };

  // Select Date in Calendar to prepare Add Form
  const handleSelectDateForAdd = (dateStr: string) => {
    setRecordedAt(dateStr);
    setTargetDate(dateStr);
    window.scrollTo({ top: 280, behavior: "smooth" });
  };

  // Open Edit Modal
  const openEditModal = (rec: KafaiRecord) => {
    setEditingRecord(rec);
    setEditRecordedAt(rec.recordedAt ? rec.recordedAt.split("T")[0] : "");
    setEditTargetDate(rec.targetDate ? rec.targetDate.split("T")[0] : "");
    setEditUnit(rec.unit.toString());
  };

  // Save Edit Handler
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (!editUnit || isNaN(Number(editUnit))) {
      setError("Please enter a valid numeric unit");
      return;
    }

    setUpdating(true);
    const res = await updateKafaiApi(editingRecord._id, {
      recordedAt: editRecordedAt,
      targetDate: editTargetDate,
      unit: parseFloat(editUnit),
    });

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Record updated successfully!");
      setEditingRecord(null);
      fetchRecords();
      setTimeout(() => setSuccess(""), 3000);
    }
    setUpdating(false);
  };

  // Delete Handler
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    const res = await deleteKafaiApi(id);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Record deleted!");
      fetchRecords();
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <main className="min-h-screen w-full persona-bg text-black font-sans pb-16">
      {/* Top Navbar Header */}
      <header className="w-full bg-black text-white border-b-4 border-black px-4 py-3 shadow-[0_4px_0_0_#e60067] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-[#e60067] text-black font-black text-xs px-2 py-0.5 border border-black uppercase shadow-[2px_2px_0_0_#fff]">
              KAFAI
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#e60067] uppercase">
              USAGE CALENDAR
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/statist"
              className="bg-[#ffe600] text-black hover:bg-white font-black text-xs sm:text-sm px-3 py-1.5 border-2 border-black uppercase shadow-[2px_2px_0_0_#000] transition-all"
            >
              STATISTICS
            </Link>
            <button
              onClick={handleLogout}
              className="bg-gray-200 text-black hover:bg-red-600 hover:text-white font-black text-xs sm:text-sm px-3 py-1.5 border-2 border-black uppercase shadow-[2px_2px_0_0_#000] transition-all"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner Notifications */}
        {error && (
          <div className="p-3 bg-red-600 border-[3px] border-black text-white font-black text-sm sm:text-base shadow-[4px_4px_0_0_#000] flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError("")} className="font-black px-2 text-lg">✕</button>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-400 border-[3px] border-black text-black font-black text-sm sm:text-base shadow-[4px_4px_0_0_#000]">
            {success}
          </div>
        )}

        {/* Dynamic Cost Calculator & Multiplier Bar */}
        <section className="bg-white border-[4px] border-black p-4 sm:p-6 shadow-[8px_8px_0_0_#e60067] relative">
          <div className="absolute -top-3.5 left-4 bg-[#e60067] text-black border-2 border-black font-black text-xs px-3 py-0.5 uppercase shadow-[2px_2px_0_0_#000]">
            CALCULATOR & MULTIPLIER
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
            {/* Stat 1: Total Units */}
            <div className="bg-gray-100 border-[3px] border-black p-3.5 shadow-[3px_3px_0_0_#000]">
              <span className="text-xs font-black text-gray-600 uppercase tracking-wider block">
                TOTAL UNITS (kWh)
              </span>
              <span className="text-2xl sm:text-3xl font-black text-black">
                {totalUnitsOverall.toFixed(1)} <span className="text-sm font-bold">unit</span>
              </span>
            </div>

            {/* Stat 2: Editable Rate Multiplier */}
            <div className="bg-[#fff9db] border-[3px] border-black p-3.5 shadow-[3px_3px_0_0_#000]">
              <label className="text-xs font-black text-black uppercase tracking-wider block mb-1">
                RATE MULTIPLIER (฿/UNIT)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={ratePerUnit}
                  onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border-2 border-black px-2 py-1 font-black text-xl text-black focus:outline-none focus:bg-yellow-100"
                />
                <span className="font-black text-base">฿</span>
              </div>
              <span className="text-[11px] font-bold text-gray-600 mt-1 block">
                Saved in local storage!
              </span>
            </div>

            {/* Stat 3: Total Estimated Cost */}
            <div className="bg-[#e60067] text-black border-[3px] border-black p-3.5 shadow-[3px_3px_0_0_#000]">
              <span className="text-xs font-black uppercase tracking-wider block text-white">
                ESTIMATED COST
              </span>
              <span className="text-2xl sm:text-3xl font-black text-white">
                {totalCostOverall.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base text-white">฿</span>
              </span>
            </div>
          </div>
        </section>

        {/* Add Usage Entry Section */}
        <section className="bg-white border-[4px] border-black p-4 sm:p-6 shadow-[8px_8px_0_0_#ffe600] relative">
          <div className="absolute -top-3.5 left-4 bg-black text-white border-2 border-black font-black text-xs px-3 py-0.5 uppercase shadow-[2px_2px_0_0_#e60067]">
            + ADD ELECTRIC USAGE
          </div>

          <form onSubmit={handleAddRecord} className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3.5 items-end">
            <div>
              <label className="block text-xs font-black uppercase mb-1">RECORDED DATE</label>
              <input
                type="date"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                className="w-full bg-white border-[3px] border-black px-3 py-2 font-bold text-sm outline-none focus:bg-pink-50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">TARGET DATE</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-white border-[3px] border-black px-3 py-2 font-bold text-sm outline-none focus:bg-pink-50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase mb-1">ELECTRIC UNITS (kWh)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 12.5"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-white border-[3px] border-black px-3 py-2 font-bold text-sm outline-none focus:bg-pink-50"
                required
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-black text-[#e60067] hover:bg-[#e60067] hover:text-black font-black py-2.5 px-4 text-base uppercase border-[3px] border-black shadow-[4px_4px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-50"
              >
                {submitting ? "SAVING..." : "+ SAVE ENTRY"}
              </button>
            </div>
          </form>
        </section>

        {/* Schedule View Container */}
        <section className="bg-white border-[4px] border-black p-4 sm:p-6 shadow-[8px_8px_0_0_#000] relative">
          {/* Header Controls & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-dashed border-gray-300">
            <div className="flex items-center gap-2">
              <span className="bg-[#ffe600] text-black border-2 border-black font-black text-xs px-2.5 py-0.5 uppercase shadow-[2px_2px_0_0_#000]">
                SCHEDULE
              </span>
              <h2 className="text-xl font-black uppercase">
                {monthInfo.monthName}
              </h2>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="bg-gray-100 border-2 border-black p-0.5 flex gap-1 shadow-[2px_2px_0_0_#000]">
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`px-2.5 py-1 text-xs font-black uppercase border border-black transition-all ${
                    viewMode === "calendar"
                      ? "bg-black text-[#ffe600]"
                      : "bg-white text-black hover:bg-gray-200"
                  }`}
                >
                  CALENDAR VIEW
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1 text-xs font-black uppercase border border-black transition-all ${
                    viewMode === "table"
                      ? "bg-black text-[#ffe600]"
                      : "bg-white text-black hover:bg-gray-200"
                  }`}
                >
                  TABLE VIEW
                </button>
                <button
                  onClick={() => setViewMode("card")}
                  className={`px-2.5 py-1 text-xs font-black uppercase border border-black transition-all ${
                    viewMode === "card"
                      ? "bg-black text-[#e60067]"
                      : "bg-white text-black hover:bg-gray-200"
                  }`}
                >
                  LIST VIEW
                </button>
              </div>

              <button
                onClick={fetchRecords}
                className="bg-black text-white hover:bg-[#e60067] font-black text-xs px-3 py-1.5 border-2 border-black uppercase shadow-[2px_2px_0_0_#000]"
              >
                REFRESH
              </button>
            </div>
          </div>

          {/* Month Stepper Header (First Day to Last Day Cycle) */}
          <div className="mb-4 bg-[#fff9db] border-[3px] border-black p-3 shadow-[3px_3px_0_0_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="bg-black text-white hover:bg-[#e60067] font-black text-xs px-3 py-1.5 border-2 border-black uppercase shadow-[2px_2px_0_0_#000]"
              >
                &lt; PREV MONTH
              </button>
              <button
                onClick={nextMonth}
                className="bg-black text-white hover:bg-[#e60067] font-black text-xs px-3 py-1.5 border-2 border-black uppercase shadow-[2px_2px_0_0_#000]"
              >
                NEXT MONTH &gt;
              </button>
            </div>

            <div>
              <span className="text-[10px] font-black text-gray-600 uppercase block">
                MONTH CYCLE (FIRST DAY - LAST DAY)
              </span>
              <span className="font-black text-sm text-black">
                {monthInfo.firstDayStr} — {monthInfo.lastDayStr}
              </span>
            </div>

            {/* Pinned Month Totals */}
            <div className="flex items-center gap-2">
              <div className="bg-black text-white px-2.5 py-1 text-xs font-black border border-black">
                UNITS: <span className="text-[#ffe600] text-sm">{monthUnits.toFixed(1)}</span> kWh
              </div>
              <div className="bg-[#e60067] text-black px-2.5 py-1 text-xs font-black border border-black shadow-[2px_2px_0_0_#000]">
                COST: <span className="text-white text-sm">{monthCost.toFixed(2)}</span> ฿
              </div>
            </div>
          </div>

          {/* CALENDAR VIEW MODE */}
          {viewMode === "calendar" && (
            <div className="space-y-4">
              {/* Calendar Grid Header Days */}
              <div className="grid grid-cols-7 gap-1 text-center bg-black text-white border-2 border-black font-black text-xs uppercase py-2">
                <div>SUN</div>
                <div>MON</div>
                <div>TUE</div>
                <div>WED</div>
                <div>THU</div>
                <div>FRI</div>
                <div>SAT</div>
              </div>

              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {/* Empty cells before start of month */}
                {Array.from({ length: monthInfo.startDayOfWeek }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[70px] sm:min-h-[90px] bg-gray-100/50 border border-gray-200"
                  ></div>
                ))}

                {/* Days of the month */}
                {Array.from({ length: monthInfo.daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dayDateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const dayRecords = recordsByDateMap[dayDateStr] || [];
                  const dayTotalUnits = dayRecords.reduce((acc, r) => acc + (Number(r.unit) || 0), 0);
                  const dayTotalCost = dayTotalUnits * ratePerUnit;
                  const isToday = dayDateStr === todayStr;

                  return (
                    <div
                      key={`day-${dayNum}`}
                      className={`min-h-[75px] sm:min-h-[95px] border-2 border-black p-1.5 flex flex-col justify-between transition-all relative ${
                        isToday ? "bg-[#fff9db] border-4 shadow-[2px_2px_0_0_#e60067]" : "bg-white"
                      } ${dayRecords.length > 0 ? "hover:bg-pink-50" : ""}`}
                    >
                      {/* Day Number Header */}
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-xs sm:text-sm font-black px-1.5 py-0.5 ${
                            isToday ? "bg-black text-[#ffe600]" : "text-black"
                          }`}
                        >
                          {dayNum}
                        </span>

                        {dayRecords.length === 0 && (
                          <button
                            onClick={() => handleSelectDateForAdd(dayDateStr)}
                            className="text-[10px] font-black bg-gray-200 hover:bg-black hover:text-white px-1 border border-black hidden sm:block"
                            title="Add usage for this date"
                          >
                            + ADD
                          </button>
                        )}
                      </div>

                      {/* Day Content: Units & Cost Badges */}
                      {dayRecords.length > 0 ? (
                        <div className="space-y-1 my-1">
                          {/* Unit Badge */}
                          <div className="bg-[#e60067] text-black border border-black px-1 py-0.5 font-black text-[10px] sm:text-xs leading-none shadow-[1px_1px_0_0_#000] truncate">
                            {dayTotalUnits.toFixed(1)} kWh
                          </div>
                          {/* Cost Badge */}
                          <div className="bg-[#ffe600] text-black border border-black px-1 py-0.5 font-black text-[10px] sm:text-xs leading-none shadow-[1px_1px_0_0_#000] truncate">
                            {dayTotalCost.toFixed(2)} ฿
                          </div>

                          {/* Quick Edit button for first record */}
                          <button
                            onClick={() => openEditModal(dayRecords[0])}
                            className="w-full bg-black text-white hover:bg-[#e60067] text-[9px] sm:text-[10px] font-black uppercase py-0.5 border border-black mt-1"
                          >
                            EDIT ({dayRecords.length})
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleSelectDateForAdd(dayDateStr)}
                          className="h-full cursor-pointer flex items-center justify-center text-[10px] font-bold text-gray-300 hover:text-black"
                        >
                          +
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TABLE VIEW MODE */}
          {viewMode === "table" && (
            <div className="overflow-x-auto border-[3px] border-black shadow-[4px_4px_0_0_#000]">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-black text-white text-xs font-black uppercase border-b-3 border-black">
                    <th className="p-3 border-r-2 border-gray-800">TARGET DATE</th>
                    <th className="p-3 border-r-2 border-gray-800">RECORDED DATE</th>
                    <th className="p-3 border-r-2 border-gray-800 bg-[#e60067] text-black text-center">
                      UNITS (kWh)
                    </th>
                    <th className="p-3 border-r-2 border-gray-800 bg-[#ffe600] text-black text-center">
                      COST ({ratePerUnit}฿/u)
                    </th>
                    <th className="p-3 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center font-black text-gray-400 uppercase">
                        No entries recorded for {monthInfo.monthName}
                      </td>
                    </tr>
                  ) : (
                    monthlyRecords.map((rec, idx) => {
                      const itemCost = (Number(rec.unit) || 0) * ratePerUnit;
                      const isEven = idx % 2 === 0;

                      return (
                        <tr
                          key={rec._id}
                          className={`border-b-2 border-black text-sm font-bold hover:bg-pink-50 transition-colors ${
                            isEven ? "bg-white" : "bg-gray-50"
                          }`}
                        >
                          <td className="p-3 border-r-2 border-black font-black">
                            {formatDate(rec.targetDate)}
                          </td>
                          <td className="p-3 border-r-2 border-black text-gray-700">
                            {formatDate(rec.recordedAt)}
                          </td>
                          <td className="p-3 border-r-2 border-black text-center font-black text-base text-[#e60067] bg-pink-50/50">
                            {rec.unit} <span className="text-xs text-black">kWh</span>
                          </td>
                          <td className="p-3 border-r-2 border-black text-center font-black text-base text-black bg-yellow-50/50">
                            {itemCost.toFixed(2)} <span className="text-xs">฿</span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openEditModal(rec)}
                                className="bg-black text-white hover:bg-[#e60067] font-black text-xs px-2.5 py-1 border-2 border-black uppercase shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                              >
                                EDIT
                              </button>
                              <button
                                onClick={() => handleDelete(rec._id)}
                                className="bg-red-600 text-white hover:bg-black font-black text-xs px-2.5 py-1 border-2 border-black uppercase shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                              >
                                DEL
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-black text-white font-black text-sm border-t-4 border-black">
                    <td colSpan={2} className="p-3 text-right uppercase tracking-wider text-xs border-r-2 border-gray-800">
                      TOTAL FOR {monthInfo.monthName.toUpperCase()}:
                    </td>
                    <td className="p-3 text-center bg-[#e60067] text-black text-base font-black border-r-2 border-black">
                      {monthUnits.toFixed(1)} kWh
                    </td>
                    <td className="p-3 text-center bg-[#ffe600] text-black text-base font-black border-r-2 border-black">
                      {monthCost.toFixed(2)} ฿
                    </td>
                    <td className="p-3 text-center text-xs text-gray-400">
                      {monthlyRecords.length} ENTRIES
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* CARD VIEW MODE */}
          {viewMode === "card" && (
            <div className="space-y-3">
              {monthlyRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-400 font-black uppercase border-2 border-dashed border-gray-300">
                  No entries for {monthInfo.monthName}
                </div>
              ) : (
                monthlyRecords.map((rec) => {
                  const itemCost = (Number(rec.unit) || 0) * ratePerUnit;

                  return (
                    <div
                      key={rec._id}
                      className="bg-gray-50 border-[3px] border-black p-3.5 shadow-[4px_4px_0_0_#000] hover:bg-pink-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] font-black text-gray-500 uppercase block">TARGET DATE</span>
                          <span className="font-black text-sm text-black">{formatDate(rec.targetDate)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-gray-500 uppercase block">RECORDED DATE</span>
                          <span className="font-bold text-xs text-gray-700">{formatDate(rec.recordedAt)}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-black text-gray-500 uppercase block">USAGE (kWh)</span>
                          <span className="font-black text-lg text-[#e60067]">
                            {rec.unit} <span className="text-xs text-black font-bold">units</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                        <div className="bg-[#ffe600] border-2 border-black px-3 py-1 shadow-[2px_2px_0_0_#000]">
                          <span className="text-[10px] font-black uppercase block leading-none">COST ({ratePerUnit}฿/u)</span>
                          <span className="font-black text-base leading-tight">
                            {itemCost.toFixed(2)} ฿
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(rec)}
                            className="bg-black text-white hover:bg-[#e60067] font-black text-xs px-2.5 py-1.5 border-2 border-black uppercase shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleDelete(rec._id)}
                            className="bg-red-600 text-white hover:bg-black font-black text-xs px-2.5 py-1.5 border-2 border-black uppercase shadow-[2px_2px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
                          >
                            DEL
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>
      </div>

      {/* Edit Record Modal Overlay */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-[4px] border-black p-6 w-full max-w-md shadow-[10px_10px_0_0_#e60067] relative">
            <div className="flex justify-between items-center mb-4 border-b-3 border-black pb-2">
              <h3 className="text-xl font-black uppercase">EDIT USAGE ENTRY</h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="bg-black text-white font-black px-2 py-0.5 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">RECORDED DATE</label>
                <input
                  type="date"
                  value={editRecordedAt}
                  onChange={(e) => setEditRecordedAt(e.target.value)}
                  className="w-full bg-white border-[3px] border-black px-3 py-2 font-bold text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">TARGET DATE</label>
                <input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                  className="w-full bg-white border-[3px] border-black px-3 py-2 font-bold text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">ELECTRIC UNITS (kWh)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  className="w-full bg-white border-[3px] border-black px-3 py-2 font-bold text-sm outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="bg-gray-300 text-black font-black px-4 py-2 border-2 border-black text-xs uppercase"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="bg-black text-[#e60067] hover:bg-[#e60067] hover:text-black font-black px-4 py-2 border-2 border-black text-xs uppercase shadow-[3px_3px_0_0_#000]"
                >
                  {updating ? "SAVING..." : "SAVE CHANGES"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
