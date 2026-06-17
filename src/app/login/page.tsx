"use client";

import React, { useState } from "react";
import { useAuth } from "../../context/auth-context";
import { Button } from "../../components/ui/button";
import { ShieldAlert } from "lucide-react";
import { isConfigValid } from "../../lib/firebase";
import { BrandMark } from "../../components/brand-mark";

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      // Redirect is handled automatically by layout-wrapper.tsx
    } catch (err) {
      console.error(err);
      const errorVal = err as { message?: string };
      setError(errorVal?.message || "Failed to sign in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 bg-[#09090B] relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-sm z-10">
        <div className="text-center mb-8 flex flex-col items-center">
          <BrandMark
            priority
            className="mb-4 h-18 w-18 rounded-2xl border-blue-400/20 shadow-2xl shadow-blue-950/30"
          />
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Offset</h1>
          <p className="text-zinc-400 text-sm">
            Track your card liabilities effortlessly.
          </p>
        </div>

        <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 shadow-xl relative">
          {!isConfigValid && (
            <div className="mb-4 flex flex-col gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-400">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
                <span>Firebase Keys Missing</span>
              </div>
              <span className="text-zinc-400 leading-normal">
                Firebase client variables were not available when this build started. On Netlify, confirm every <code className="text-zinc-200 bg-zinc-800 px-0.5 rounded">NEXT_PUBLIC_FIREBASE_*</code> variable is set for Production and redeploy the site.
              </span>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleLogin}
            disabled={loading || !isConfigValid}
            className="w-full h-11 bg-white hover:bg-zinc-100 text-black font-semibold flex items-center justify-center gap-2 rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="h-5 w-5 mr-1" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 0, 0)">
                  <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.4C21.68,11.72 21.56,11.37 21.35,11.1z" fill="#4285F4" />
                  <path d="M12,20.8c2.43,0 4.47,-0.8 5.96,-2.2l-3.3,-2.58c-0.92,0.62 -2.1,1.0 -2.66,1.0c-2.43,0 -4.5,-1.64 -5.24,-3.84H3.34v2.64C4.84,18.8 8.16,20.8 12,20.8z" fill="#34A853" />
                  <path d="M6.76,13.18C6.56,12.58 6.56,11.42 6.76,10.82V8.18H3.34c-0.67,1.34 -1.06,2.83 -1.06,4.4c0,1.57 0.39,3.06 1.06,4.4L6.76,13.18z" fill="#FBBC05" />
                  <path d="M12,6.48c1.33,0 2.52,0.46 3.46,1.35l2.6,-2.6C16.47,3.64 14.43,2.8 12,2.8C8.16,2.8 4.84,4.8 3.34,7.82l3.42,2.64C7.5,8.22 9.57,6.48 12,6.48z" fill="#EA4335" />
                </g>
              </svg>
            )}
            {loading ? "Signing in..." : "Continue with Google"}
          </Button>

          <p className="mt-4 text-center text-xs text-zinc-500">
            By continuing, you agree to {"Offset's"} terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
