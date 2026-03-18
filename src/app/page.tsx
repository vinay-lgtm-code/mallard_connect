"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  Clock,
  BarChart3,
  Shield,
  ChevronRight,
  GitBranch,
  Bell,
  Smartphone,
} from "lucide-react";

function Header({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">MC</span>
          </div>
          <span className="text-lg font-bold text-gray-900">Mallard Connect</span>
        </div>

        <nav className="hidden sm:flex items-center gap-1">
          {["Home", "About"].map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <Link
          href="/login"
          className="bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-dark transition-colors"
        >
          Log In
        </Link>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-sidebar via-primary-dark to-primary text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
            Never lose track of{" "}
            <span className="text-accent">a prospect</span>{" "}
            again.
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/80 leading-relaxed max-w-2xl">
            A lightweight lead nurturing system that ensures every follow-up happens on time.
            Works alongside your existing MAB Platform — no rip-and-replace needed.
          </p>

          <div className="flex flex-wrap gap-4 mt-10">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-accent text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-accent-light transition-colors text-sm"
            >
              Get Started
              <ChevronRight size={16} />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/20 transition-colors text-sm border border-white/20"
            >
              See How It Works
            </a>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 border-t border-white/10 pt-10">
          {[
            { value: "6", label: "Pipeline stages" },
            { value: "3", label: "Reminder recipients" },
            { value: "7am", label: "Daily digest" },
            { value: "100%", label: "Mobile-friendly" },
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
      icon: GitBranch,
      title: "Visual Pipeline",
      description: "Drag-and-drop Kanban board with 6 stages — from New Enquiry through to Referred to MAB. See where every prospect sits at a glance.",
    },
    {
      icon: Bell,
      title: "Automated Reminders",
      description: "Schedule follow-ups with a date and reason. Daily 7am email reminders go to up to 3 recipients so nothing falls through the cracks.",
    },
    {
      icon: Users,
      title: "Team Visibility",
      description: "Managers see the full pipeline and team activity. Advisers see their own leads and today's follow-up list. Everyone stays accountable.",
    },
    {
      icon: Smartphone,
      title: "Mobile-First",
      description: "Quick-capture leads on the go between appointments. Tap-to-call from follow-up cards. Works on any phone, tablet, or desktop.",
    },
    {
      icon: Clock,
      title: "Long-Cycle Nurturing",
      description: "First-time buyer saving for a deposit? Set a 6-month reminder. Mallard Connect holds the thread so your team doesn't have to.",
    },
    {
      icon: Shield,
      title: "Works With MAB Platform",
      description: "No need to rip out your existing system. Import leads from MAB via CSV and bolt on structured follow-up tracking alongside it.",
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Everything your team needs
          </h2>
          <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto">
            Simple tools that mortgage advisers actually use — not a bloated CRM they won&apos;t.
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

function AboutSection() {
  return (
    <section className="py-16 sm:py-24 bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
            About Mallard Connect
          </h2>

          <div className="space-y-6 text-gray-600 leading-relaxed">
            <p>
              <strong className="text-gray-900">Mallard Mortgages</strong> is a Sheffield-based mortgage
              brokerage led by Della Mallard. The team works with the Mortgage Advice Bureau&apos;s Platform
              system for their day-to-day operations — and it works well enough for active cases.
            </p>

            <p>
              But prospects who enquire and aren&apos;t ready to proceed — a first-time buyer still saving,
              a remortgage not due for six months — were falling through the cracks. Advisers would
              jot down &ldquo;call again in January&rdquo; but there was no structured process to make sure
              that follow-up actually happened.
            </p>

            <p>
              <strong className="text-gray-900">Mallard Connect</strong> was built to solve exactly that.
              It&apos;s a lightweight pre-CRM that bolts onto the existing workflow: structured lead intake,
              visual pipeline tracking, and automated follow-up reminders delivered to the team every
              morning at 7am.
            </p>

            <p>
              No expensive CRM subscription. No ripping out existing systems. Just a simple, mobile-friendly
              tool that ensures no prospect is forgotten.
            </p>
          </div>

          <div className="mt-10 p-6 rounded-[12px] bg-white border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">SD</span>
              </div>
              <div>
                <p className="text-sm text-gray-600 italic leading-relaxed">
                  &ldquo;We built Mallard Connect to give Della&apos;s team the follow-up structure they
                  needed without the overhead of a full CRM. It works alongside what they already
                  have and fits how mortgage advisers actually work — on the go, between appointments.&rdquo;
                </p>
                <p className="mt-3 text-sm font-semibold text-gray-900">Storyboard Digital</p>
                <p className="text-xs text-gray-500">Sheffield, UK</p>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              Log In to Mallard Connect
              <ChevronRight size={16} />
            </Link>
          </div>
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
            <span className="text-white text-[10px] font-bold">MC</span>
          </div>
          <span className="text-sm">Mallard Connect</span>
        </div>
        <p className="text-xs">
          Mallard Mortgages, Sheffield UK &middot; Built by Storyboard Digital
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState("Home");

  return (
    <div className="min-h-screen bg-white">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "Home" ? (
        <>
          <HeroSection />
          <FeaturesSection />
        </>
      ) : (
        <AboutSection />
      )}

      <Footer />
    </div>
  );
}
