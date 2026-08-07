"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginApi } from "../libs/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await loginApi(username, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/");
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
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight uppercase persona-title-shadow mb-4">
              LOGIN
            </h1>

            {/* Full Width Black Banner */}
            <div className="persona-banner">
              READY TO START?
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-600 border-[3px] border-black text-white text-sm sm:text-base font-black text-center shadow-[4px_4px_0_0_#000] uppercase">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6 mt-4">
            {/* Input 1: PLAYER ID */}
            <div className="relative w-full">
              <label className="persona-badge">
                PLAYER ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter Username"
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

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="persona-btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "AUTHENTICATING..." : "Login"}
              </button>
            </div>
          </form>

          {/* Switch to Register link */}
          <div className="mt-8 text-center border-t-2 border-dashed border-gray-300 pt-4">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center justify-center gap-2 flex-wrap">
              <span>NEW ?</span>
              <Link
                href="/register"
                className="inline-block bg-[#e60067] text-black px-2.5 py-1 border-2 border-black font-black hover:bg-black hover:text-[#e60067] transition-all shadow-[2px_2px_0_0_#000]"
              >
                CREATE ACCOUNT
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}