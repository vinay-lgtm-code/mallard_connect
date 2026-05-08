"use client";

import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";

const INCLUDED = [
  "Multi-step nurture cadences",
  "Activity logging (call / email / SMS / WhatsApp / meeting / note)",
  "Email & SMS templates with variables",
  "Pipeline kanban (laptop) + list view (mobile)",
  "MAB Platform CSV import with auto column-mapping",
  "Brevo integration (one-way contact + event sync)",
  "Daily 7am UK reminder digest via Resend",
  "Manager KPI dashboards & adviser leaderboards",
  "Vanity subdomain ({firm}.sequence-ai.com)",
  "Full-tenant audit trail",
];

function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="text-lg font-bold text-gray-900">Sequence</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm">
          <Link href="/#features" className="text-gray-600 hover:text-gray-900">Features</Link>
          <Link href="/pricing" className="text-gray-900 font-medium">Pricing</Link>
          <Link href="/demo" className="text-gray-600 hover:text-gray-900">Demo</Link>
        </nav>
        <Link
          href="/login"
          className="text-sm font-medium text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          Log in
        </Link>
      </div>
    </header>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-4xl mx-auto px-6 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-primary mb-2">Pricing</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            One simple tier. Everything included.
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            14-day free trial. No card required. Cancel any time.
          </p>
        </div>

        <div className="mt-12 grid lg:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <div className="rounded-[16px] bg-white border-2 border-primary p-7 shadow-sm relative">
            <span className="absolute -top-3 left-7 inline-block text-xs font-bold uppercase tracking-wider px-2 py-1 rounded bg-primary text-white">
              Recommended
            </span>
            <p className="text-sm font-semibold text-gray-700">Sequence — Base</p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-5xl font-bold text-gray-900">£50</span>
              <span className="text-gray-500">/ month</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Up to 5 users (manager + 4 advisers)
            </p>
            <p className="mt-1 text-xs text-gray-400">+ £8/month for each additional adviser</p>

            <Link
              href="/checkout"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-5 py-3 rounded-lg hover:bg-primary-dark text-sm"
            >
              Start free trial
              <ChevronRight size={14} />
            </Link>

            <div className="mt-7 pt-6 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Everything included
              </p>
              <ul className="space-y-2.5">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check size={15} className="text-primary flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-[16px] bg-white border border-gray-200 p-7">
            <p className="text-sm font-semibold text-gray-700">Sequence — Growth</p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-5xl font-bold text-gray-900">Talk</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Multi-firm groups, white-label, custom integrations
            </p>

            <a
              href="mailto:hello@sequence-ai.com"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-semibold px-5 py-3 rounded-lg hover:bg-gray-50 text-sm"
            >
              Contact sales
            </a>

            <div className="mt-7 pt-6 border-t border-gray-100 space-y-2.5 text-sm text-gray-700">
              <p className="flex items-start gap-2">
                <Check size={15} className="text-primary flex-shrink-0 mt-0.5" />
                Everything in Base
              </p>
              <p className="flex items-start gap-2">
                <Check size={15} className="text-primary flex-shrink-0 mt-0.5" />
                Full white-label: your own domain, logo, sender
              </p>
              <p className="flex items-start gap-2">
                <Check size={15} className="text-primary flex-shrink-0 mt-0.5" />
                Bespoke CRM integrations (Intelligent Office, Smart365, custom)
              </p>
              <p className="flex items-start gap-2">
                <Check size={15} className="text-primary flex-shrink-0 mt-0.5" />
                Dedicated onboarding and SLA
              </p>
            </div>
          </div>
        </div>

        <div className="mt-14 max-w-2xl mx-auto text-center">
          <p className="text-sm text-gray-500">
            Want to see it in action first? <Link href="/demo" className="text-primary font-medium hover:underline">Try the live demo</Link> — no signup required.
          </p>
        </div>

        <div className="mt-14 max-w-2xl mx-auto bg-white border border-gray-100 rounded-[12px] p-6">
          <p className="text-sm font-semibold text-gray-900 mb-3">Common questions</p>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-gray-900">Do I need to replace my current CRM?</p>
              <p className="text-gray-600 mt-0.5">No. Sequence is built to bolt on. We pull contacts from Brevo or import MAB CSVs — your current system stays as your source of truth.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">What about FCA compliance?</p>
              <p className="text-gray-600 mt-0.5">Every interaction is logged with a tamper-evident audit trail. Data is hosted in EU regions, GDPR-compliant, with 6-year retention controls.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Can I cancel?</p>
              <p className="text-gray-600 mt-0.5">Anytime. Monthly billing, no contract. We&apos;ll give you a full export of your data on request.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-sidebar text-white/60 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">S</span>
            </div>
            <span className="text-sm">Sequence</span>
          </Link>
          <p className="text-xs">sequence-ai.com</p>
        </div>
      </footer>
    </div>
  );
}
