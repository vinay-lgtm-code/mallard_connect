"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CreditCard, Lock } from "lucide-react";

export default function CheckoutPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // Mock — no payment is taken. Real Stripe wiring lands later.
    await new Promise((r) => setTimeout(r, 1000));
    router.push("/onboarding");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="text-lg font-bold text-gray-900">Sequence</span>
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft size={14} />
            Back to pricing
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-5 gap-6">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-3 bg-white border border-gray-100 rounded-[16px] p-7"
          >
            <h1 className="text-xl font-bold text-gray-900 mb-1">Start your 14-day free trial</h1>
            <p className="text-sm text-gray-500 mb-6">No charge today. Cancel any time before day 14.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@firm.co.uk"
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Card details
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Card number</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="1234 1234 1234 1234"
                      className="w-full border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <CreditCard
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Expiry</label>
                    <input
                      type="text"
                      placeholder="MM / YY"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CVC</label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                  Billing postcode
                </label>
                <input
                  type="text"
                  placeholder="S1 1AB"
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-7 w-full inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-5 py-3 rounded-lg hover:bg-primary-dark disabled:opacity-60 text-sm"
            >
              {submitting ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Starting trial...
                </>
              ) : (
                "Start free trial"
              )}
            </button>

            <p className="mt-3 text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
              <Lock size={11} />
              This is a demo checkout. No card is charged.
            </p>
          </form>

          <aside className="lg:col-span-2 bg-white border border-gray-100 rounded-[16px] p-7 self-start">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Order summary</p>

            <div className="space-y-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-gray-700">Sequence — Base (5 users)</span>
                <span className="font-semibold text-gray-900">£50.00</span>
              </div>
              <div className="text-xs text-gray-500">Billed monthly</div>
              <div className="border-t border-gray-100 pt-3 flex items-baseline justify-between">
                <span className="text-gray-700 font-medium">Total today</span>
                <span className="font-bold text-gray-900">£0.00</span>
              </div>
              <div className="text-xs text-gray-500">First charge of £50.00 on day 14.</div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100 space-y-2 text-xs text-gray-600">
              {["14 days, no charge", "Cancel any time", "Full data export on request"].map((line) => (
                <p key={line} className="flex items-center gap-2">
                  <Check size={13} className="text-primary" />
                  {line}
                </p>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
