"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerApi } from "../libs/api";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passcodes do not match!");
      return;
    }

    setLoading(true);

    const result = await registerApi(username, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(result.message || "Account created successfully!");
      setLoading(false);
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 persona-bg overflow-x-hidden">
      {/* Centered Constrained Wrapper */}
      <div className="persona-card-wrapper my-8">
        {/* Decorative Rectangles sticking out behind frame */}
        <div className="persona-deco-left hidden sm:block"></div>
        <div className="persona-deco-right hidden sm:block"></div>

        {/* Main Card Frame */}
        <div className="persona-card">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight uppercase persona-title-shadow mb-4">
              REGISTER
            </h1>

            {/* Full Width Black Banner */}
            <div className="persona-banner">
              JOIN THE REBELLION?
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-600 border-[3px] border-black text-white text-sm sm:text-base font-black text-center shadow-[4px_4px_0_0_#000] uppercase">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-3 bg-emerald-400 border-[3px] border-black text-black text-sm sm:text-base font-black text-center shadow-[4px_4px_0_0_#000] uppercase">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-6 mt-4">
            {/* Input 1: PLAYER ID */}
            <div className="relative w-full">
              <label className="persona-badge">
                PLAYER ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose Username"
                className="persona-input"
                required
              />
            </div>

            {/* Input 2: PASSCODE */}
            <div className="relative w-full">
              <label className="persona-badge">
                PASSCODE
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="persona-input"
                required
              />
            </div>

            {/* Input 3: CONFIRM PASSCODE */}
            <div className="relative w-full">
              <label className="persona-badge">
                CONFIRM PASSCODE
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="persona-input"
                required
              />
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="persona-btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "CREATING..." : "JOIN THE REBELLION"}
              </button>
            </div>
          </form>

          {/* Switch to Login link */}
          <div className="mt-8 text-center border-t-2 border-dashed border-gray-300 pt-4">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center justify-center gap-2 flex-wrap">
              <span>ALREADY A MEMBER?</span>
              <Link
                href="/login"
                className="inline-block bg-[#e60067] text-black px-2.5 py-1 border-2 border-black font-black hover:bg-black hover:text-[#e60067] transition-all shadow-[2px_2px_0_0_#000]"
              >
                LOGIN HERE
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
