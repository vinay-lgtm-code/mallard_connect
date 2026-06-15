"use client";

import Link from "next/link";
import {
  Users,
  Clock,
  Shield,
  ChevronRight,
  GitBranch,
  Zap,
  Smartphone,
  Mail,
} from "lucide-react";

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
          <a
            href="#features"
            onClick={(e) => { e.preventDefault(); document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }); }}
            className="text-gray-600 hover:text-gray-900"
          >Features</a>
          <Link href="/demo" className="text-gray-600 hover:text-gray-900">Demo</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm font-medium text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            Log in
          </Link>
          <Link
            href="/demo"
            className="bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark transition-colors"
          >
            Try the demo
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-sidebar via-primary-dark to-primary text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/80 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
            For UK mortgage advisers
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
            Never lose track of <span className="text-accent">a prospect</span> again.
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/80 leading-relaxed max-w-2xl">
            Sequence is the lightweight nurture layer that bolts onto whatever you already use &mdash;
            MAB Platform, FLG, Dashly, Intelligent Office. Structured cadences, complete activity
            logging, automated reminders. No rip-and-replace.
          </p>

          <div className="flex flex-wrap gap-4 mt-10">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 bg-accent text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-accent-light transition-colors text-sm"
            >
              Try the demo
              <ChevronRight size={16} />
            </Link>
            <a
              href="#features"
              onClick={(e) => { e.preventDefault(); document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }); }}
              className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/20 transition-colors text-sm border border-white/20"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8 border-t border-white/10 pt-10">
          {[
            { value: "MAB / Brevo", label: "Pulls from your CRM" },
            { value: "7am", label: "Daily cadence digest" },
            { value: "Laptop-first", label: "Built for the way you work" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl sm:text-3xl font-bold text-accent">{stat.value}</p>
              <p className="text-sm text-white/60 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      title: "Multi-step cadences",
      description:
        "Day 0 email, day 7 SMS, day 30 reminder — automate every long-cycle nurture. Trigger by stage change, manual enrollment, or new lead arrival.",
    },
    {
      icon: GitBranch,
      title: "Visual pipeline",
      description:
        "Drag-and-drop Kanban with a first-class “Not Ready Yet” stage — the column where most prospects currently fall through the cracks.",
    },
    {
      icon: Mail,
      title: "Complete activity logging",
      description:
        "Call, email, meeting, note, SMS, WhatsApp — one-click logging with templates. Every prospect has a full timeline you can scan in seconds.",
    },
    {
      icon: Users,
      title: "Manager visibility",
      description:
        "Owners see the whole pipeline, team activity, and at-a-glance KPIs. Advisers see their own follow-up list. Everyone stays accountable without micromanaging.",
    },
    {
      icon: Clock,
      title: "Long-cycle nurture",
      description:
        "First-time buyer saving for a deposit? 6-month remortgage warm-up? Sequence holds the thread so your team doesn’t have to remember.",
    },
    {
      icon: Shield,
      title: "Works with your CRM",
      description:
        "Pulls contacts from Brevo when you have it. Imports MAB Platform CSV exports when you don’t. We never ask you to abandon your primary system.",
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Built for the way advisers actually work</h2>
          <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">
            Tools that fit your existing back-office &mdash; not a bloated CRM you won&apos;t use.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-[12px] border border-gray-100 p-6 hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-primary" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="py-16 sm:py-24 bg-card">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">The problem we solve</h2>

        <div className="space-y-6 text-gray-600 leading-relaxed">
          <p>
            Most UK mortgage firms have a back-office system that works fine for active cases &mdash;
            MAB Platform, FLG, Dashly. The problem is the prospects who aren&apos;t ready to proceed yet.
          </p>
          <p>
            A first-time buyer still saving a deposit. A self-employed client building accounts history.
            A remortgage that isn&apos;t due for six months. Your team jots down &ldquo;contact again
            in January&rdquo; &mdash; but there&apos;s no structured process to make sure that
            follow-up actually happens.
          </p>
          <p>
            <strong className="text-gray-900">Sequence is the nurture layer that fits between
            enquiry and active case.</strong> Cadences run on autopilot. Activity logging is one click.
            Owners see the whole pipeline. Nothing falls through the cracks &mdash; even when the
            buying window is twelve months away.
          </p>
        </div>

        <div className="mt-10 p-6 rounded-[12px] bg-white border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={16} className="text-primary" />
            <p className="text-sm font-semibold text-gray-900">Laptop-first, mobile-aware</p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Sequence is built primarily for the laptop &mdash; the screen where advisers and owners
            actually do their day. Pipeline kanban, multi-column forms, manager dashboards, and table
            views are designed for &ge;1280px. Mobile views exist for what mobile is good at: quick
            lead capture between appointments and tap-to-call from your follow-up list.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors text-sm"
          >
            Try the live demo
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-sidebar text-white/60 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">S</span>
          </div>
          <span className="text-sm">Sequence</span>
        </div>
        <p className="text-xs">
          sequence-ai.com &middot; Built by Storyboard Digital / Legacy Labs
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <ProblemSection />
      <Footer />
    </div>
  );
}
