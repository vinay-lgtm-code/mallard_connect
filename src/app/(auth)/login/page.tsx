"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { setDemoUser } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.app_metadata?.tenant_id) {
        const params = new URLSearchParams(window.location.search);
        const r = params.get("redirect");
        const safe = r && r.startsWith("/") && !r.startsWith("//") && !r.startsWith("/\\") ? r : "/dashboard";
        router.push(safe);
      } else {
        router.push("/onboarding");
      }
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin(mode: "demo-manager" | "demo-sales") {
    setDemoUser(mode);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[12px] shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-current">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
              <path d="M8 12l3 3 5-5" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sequence</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <div className="flex justify-between items-center">
            <Link href="/signup" className="text-sm text-primary hover:underline">
              Create an account
            </Link>
            <a href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold rounded-lg py-2.5 text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center mb-4">Try a demo account</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDemoLogin("demo-manager")}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                <span className="text-white text-xs font-bold">DM</span>
              </div>
              <span className="text-sm font-medium text-gray-900 group-hover:text-primary">Della Mallard</span>
              <span className="text-xs text-gray-500">Owner / Manager</span>
            </button>
            <button
              onClick={() => handleDemoLogin("demo-sales")}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
                <span className="text-white text-xs font-bold">AR</span>
              </div>
              <span className="text-sm font-medium text-gray-900 group-hover:text-primary">Alex Rivera</span>
              <span className="text-xs text-gray-500">Salesperson</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
