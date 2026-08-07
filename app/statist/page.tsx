"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KafaiRecord, getKafaiListApi } from "../libs/api";

export default function StatisticsPage() {
  const router = useRouter();

  const [records, setRecords] = useState<KafaiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ratePerUnit, setRatePerUnit] = useState<number>(4);

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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchData();
  }, [router]);

  const fetchData = async () => {
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

  // ==========================================
  // STATISTICAL CALCULATIONS
  // ==========================================
  const totalRecords = records.length;
  const totalUnits = records.reduce((acc, r) => acc + (Number(r.unit) || 0), 0);
  const totalCost = totalUnits * ratePerUnit;

  // Group by Month (YYYY-MM)
  const monthlyDataMap: { [key: string]: { monthName: string; totalUnit: number; count: number } } = {};
  records.forEach((r) => {
    if (!r.targetDate && !r.recordedAt) return;
    const dateObj = new Date(r.targetDate || r.recordedAt);
    if (isNaN(dateObj.getTime())) return;

    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
    const monthName = dateObj.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    if (!monthlyDataMap[monthKey]) {
      monthlyDataMap[monthKey] = { monthName, totalUnit: 0, count: 0 };
    }
    monthlyDataMap[monthKey].totalUnit += Number(r.unit) || 0;
    monthlyDataMap[monthKey].count += 1;
  });

  const monthlyList = Object.keys(monthlyDataMap)
    .sort()
    .reverse()
    .map((key) => ({
      key,
      monthName: monthlyDataMap[key].monthName,
      totalUnit: monthlyDataMap[key].totalUnit,
      totalCost: monthlyDataMap[key].totalUnit * ratePerUnit,
      count: monthlyDataMap[key].count,
      avgDailyUnit: monthlyDataMap[key].count > 0 ? monthlyDataMap[key].totalUnit / monthlyDataMap[key].count : 0,
    }));

  const totalMonths = Object.keys(monthlyDataMap).length || 1;
  const avgMonthlyUnit = totalUnits / totalMonths;
  const avgMonthlyCost = avgMonthlyUnit * ratePerUnit;

  const estimatedAnnualUnit = avgMonthlyUnit * 12;
  const estimatedAnnualCost = estimatedAnnualUnit * ratePerUnit;

  // Explicitly typed Highest & Lowest Single Day Record
  let highestRecord: KafaiRecord | null = null;
  let lowestRecord: KafaiRecord | null = null;

  records.forEach((r) => {
    const val = Number(r.unit) || 0;
    if (!highestRecord || val > Number(highestRecord.unit)) {
      highestRecord = r;
    }
    if (!lowestRecord || val < Number(lowestRecord.unit)) {
      lowestRecord = r;
    }
  });

  // Highest Month
  let highestMonth = monthlyList.length > 0 ? monthlyList[0] : null;
  monthlyList.forEach((m) => {
    if (!highestMonth || m.totalUnit > highestMonth.totalUnit) {
      highestMonth = m;
    }
  });

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

  const maxMonthUnit = Math.max(...monthlyList.map((m) => m.totalUnit), 1);

  return (
    <main className="min-h-screen w-full persona-bg text-black font-sans pb-16">
      {/* Top Navbar Header */}
      <header className="w-full bg-black text-[#ffe600] border-b-4 border-black px-4 py-3 shadow-[0_4px_0_0_#e60067] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-[#ffe600] text-black font-black text-xs px-2 py-0.5 border border-black uppercase shadow-[2px_2px_0_0_#fff]">
              ANALYTICS
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              ELECTRICITY STATISTICS
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="bg-[#e60067] text-white hover:bg-white hover:text-black font-black text-xs sm:text-sm px-3 py-1.5 border-2 border-black uppercase shadow-[2px_2px_0_0_#000] transition-all"
            >
              SCHEDULE
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
        {/* Error notification */}
        {error && (
          <div className="p-3 bg-red-600 border-[3px] border-black text-white font-black text-sm shadow-[4px_4px_0_0_#000]">
            {error}
          </div>
        )}

        {/* Multiplier Bar */}
        <section className="bg-white border-[4px] border-black p-4 sm:p-5 shadow-[8px_8px_0_0_#ffe600] relative">
          <div className="absolute -top-3.5 left-4 bg-black text-white border-2 border-black font-black text-xs px-3 py-0.5 uppercase shadow-[2px_2px_0_0_#e60067]">
            RATE MULTIPLIER & CONVERSION
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div>
              <p className="text-sm font-black uppercase text-black">
                ELECTRIC RATE CALCULATION MULTIPLIER
              </p>
              <p className="text-xs font-bold text-gray-600">
                Saved in local storage and synced automatically across pages!
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#fff9db] border-[3px] border-black p-2 shadow-[3px_3px_0_0_#000]">
              <span className="text-xs font-black uppercase">RATE:</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={ratePerUnit}
                onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                className="w-24 bg-white border-2 border-black px-2 py-1 font-black text-lg text-black focus:outline-none focus:bg-yellow-100"
              />
              <span className="font-black text-sm">฿ / kWh</span>
            </div>
          </div>
        </section>

        {/* Overview Summary Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border-[4px] border-black p-4 shadow-[6px_6px_0_0_#000]">
            <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 uppercase inline-block mb-2">
              TOTAL CONSUMPTION
            </span>
            <div className="text-3xl font-black text-black">
              {totalUnits.toFixed(1)} <span className="text-sm">kWh</span>
            </div>
            <div className="text-xl font-black text-[#e60067] mt-1">
              {totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿
            </div>
            <span className="text-[11px] font-bold text-gray-500 block mt-1">
              Across {totalRecords} total entries recorded
            </span>
          </div>

          <div className="bg-white border-[4px] border-black p-4 shadow-[6px_6px_0_0_#e60067]">
            <span className="bg-[#e60067] text-black text-[10px] font-black px-2 py-0.5 border border-black uppercase inline-block mb-2">
              MONTHLY AVERAGE
            </span>
            <div className="text-3xl font-black text-black">
              {avgMonthlyUnit.toFixed(1)} <span className="text-sm">kWh/mo</span>
            </div>
            <div className="text-xl font-black text-[#e60067] mt-1">
              {avgMonthlyCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿/mo
            </div>
            <span className="text-[11px] font-bold text-gray-500 block mt-1">
              Based on {totalMonths} active month{totalMonths > 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-white border-[4px] border-black p-4 shadow-[6px_6px_0_0_#ffe600]">
            <span className="bg-[#ffe600] text-black text-[10px] font-black px-2 py-0.5 border border-black uppercase inline-block mb-2">
              ESTIMATED ANNUAL
            </span>
            <div className="text-3xl font-black text-black">
              {estimatedAnnualUnit.toFixed(1)} <span className="text-sm">kWh/yr</span>
            </div>
            <div className="text-xl font-black text-[#e60067] mt-1">
              {estimatedAnnualCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿/yr
            </div>
            <span className="text-[11px] font-bold text-gray-500 block mt-1">
              Projected 12-month total
            </span>
          </div>
        </section>

        {/* Peak & Extremes Section */}
        <section className="bg-white border-[4px] border-black p-4 sm:p-6 shadow-[8px_8px_0_0_#000] relative">
          <div className="absolute -top-3.5 left-4 bg-[#e60067] text-black border-2 border-black font-black text-xs px-3 py-0.5 uppercase shadow-[2px_2px_0_0_#000]">
            HIGHEST & LOWEST USAGE RECORDS
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
            {/* Highest Day */}
            <div className="bg-pink-50 border-[3px] border-black p-3.5 shadow-[3px_3px_0_0_#000]">
              <span className="text-[11px] font-black text-gray-700 uppercase block mb-1">
                MOST USED SINGLE DAY
              </span>
              {highestRecord ? (
                <div>
                  <div className="text-2xl font-black text-[#e60067]">
                    {(highestRecord as KafaiRecord).unit} <span className="text-xs text-black">kWh</span>
                  </div>
                  <div className="text-sm font-bold text-black mt-0.5">
                    {(Number((highestRecord as KafaiRecord).unit) * ratePerUnit).toFixed(2)} ฿
                  </div>
                  <div className="text-xs font-bold text-gray-600 mt-1">
                    Date: {formatDate((highestRecord as KafaiRecord).targetDate || (highestRecord as KafaiRecord).recordedAt)}
                  </div>
                </div>
              ) : (
                <span className="text-xs font-bold text-gray-400">No data available</span>
              )}
            </div>

            {/* Highest Month */}
            <div className="bg-[#fff9db] border-[3px] border-black p-3.5 shadow-[3px_3px_0_0_#000]">
              <span className="text-[11px] font-black text-gray-700 uppercase block mb-1">
                MOST USED MONTH
              </span>
              {highestMonth ? (
                <div>
                  <div className="text-2xl font-black text-black">
                    {highestMonth.totalUnit.toFixed(1)} <span className="text-xs">kWh</span>
                  </div>
                  <div className="text-sm font-bold text-[#e60067] mt-0.5">
                    {highestMonth.totalCost.toFixed(2)} ฿
                  </div>
                  <div className="text-xs font-bold text-gray-600 mt-1">
                    Month: {highestMonth.monthName} ({highestMonth.count} entries)
                  </div>
                </div>
              ) : (
                <span className="text-xs font-bold text-gray-400">No data available</span>
              )}
            </div>

            {/* Lowest Day */}
            <div className="bg-gray-100 border-[3px] border-black p-3.5 shadow-[3px_3px_0_0_#000]">
              <span className="text-[11px] font-black text-gray-700 uppercase block mb-1">
                LOWEST USED SINGLE DAY
              </span>
              {lowestRecord ? (
                <div>
                  <div className="text-2xl font-black text-gray-800">
                    {(lowestRecord as KafaiRecord).unit} <span className="text-xs text-black">kWh</span>
                  </div>
                  <div className="text-sm font-bold text-black mt-0.5">
                    {(Number((lowestRecord as KafaiRecord).unit) * ratePerUnit).toFixed(2)} ฿
                  </div>
                  <div className="text-xs font-bold text-gray-600 mt-1">
                    Date: {formatDate((lowestRecord as KafaiRecord).targetDate || (lowestRecord as KafaiRecord).recordedAt)}
                  </div>
                </div>
              ) : (
                <span className="text-xs font-bold text-gray-400">No data available</span>
              )}
            </div>
          </div>
        </section>

        {/* Monthly Breakdown Chart & List */}
        <section className="bg-white border-[4px] border-black p-4 sm:p-6 shadow-[8px_8px_0_0_#e60067] relative">
          <div className="absolute -top-3.5 left-4 bg-black text-white border-2 border-black font-black text-xs px-3 py-0.5 uppercase shadow-[2px_2px_0_0_#ffe600]">
            MONTH-BY-MONTH BREAKDOWN
          </div>

          {loading ? (
            <div className="text-center py-10 font-black text-gray-500 uppercase animate-pulse">
              LOADING MONTHLY BREAKDOWN...
            </div>
          ) : monthlyList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 font-bold uppercase">
              NO MONTHLY RECORDS FOUND
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {monthlyList.map((m) => {
                const percentage = Math.min(100, Math.round((m.totalUnit / maxMonthUnit) * 100));

                return (
                  <div key={m.key} className="bg-gray-50 border-[3px] border-black p-3.5 shadow-[3px_3px_0_0_#000]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-black text-white text-xs font-black px-2 py-0.5 uppercase">
                          {m.monthName}
                        </span>
                        <span className="text-xs font-bold text-gray-600">
                          ({m.count} record{m.count > 1 ? "s" : ""})
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm font-black">
                        <span>
                          {m.totalUnit.toFixed(1)} <span className="text-xs font-bold text-gray-600">kWh</span>
                        </span>
                        <span className="text-[#e60067]">
                          {m.totalCost.toFixed(2)} ฿
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar Visual */}
                    <div className="w-full bg-gray-200 border-2 border-black h-5 relative overflow-hidden">
                      <div
                        className="bg-[#e60067] h-full transition-all duration-500 border-r-2 border-black"
                        style={{ width: `${percentage}%` }}
                      ></div>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-black uppercase tracking-wider">
                        {percentage}% OF PEAK MONTH
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] font-bold text-gray-600 flex justify-between">
                      <span>Daily Average: {m.avgDailyUnit.toFixed(1)} kWh/entry</span>
                      <span>Cost @ {ratePerUnit}฿/unit</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
