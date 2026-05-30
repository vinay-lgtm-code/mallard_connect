"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/hooks/use-supabase";
import { User, Bell, GitBranch, ChevronUp, ChevronDown, Plus, Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineStage {
  id: string;
  name: string;
  slug: string;
  color: string;
  position: number;
  isTerminal: boolean;
}

interface NotificationPreferences {
  reminders: boolean;
  assignments: boolean;
  stageChanges: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Green", value: "#22c55e" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Orange", value: "#f97316" },
  { label: "Red", value: "#ef4444" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Purple", value: "#a855f7" },
];

const TAB_ITEMS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "pipeline", label: "Pipeline", icon: GitBranch },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;

type TabId = (typeof TAB_ITEMS)[number]["id"];

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          checked ? "bg-primary" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ userId, initialName, email, initialPhone }: {
  userId: string;
  initialName: string;
  email: string;
  initialPhone: string;
}) {
  const supabase = useSupabase();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!fullName.trim() || !supabase) {
      setError("Full name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await supabase.from("users").update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      }).eq("id", userId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Personal Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="fullName">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              className="w-full border border-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed here.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5" htmlFor="phone">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="+44 7700 900000"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <div className="mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold py-2.5 px-5 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saved ? (
              <Check size={15} />
            ) : null}
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Tab ─────────────────────────────────────────────────────────────

function PipelineTab() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const supabase = useSupabase();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState(PRESET_COLORS[0].value);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !tenantId) { setLoadingStages(false); return; }
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("position")
      .then(({ data }) => {
        if (data) setStages(data.map((d) => ({ id: d.id, name: d.name, slug: d.slug, position: d.position, color: d.color, isTerminal: d.is_terminal } as PipelineStage)));
        setLoadingStages(false);
      });
  }, [supabase, tenantId]);

  function moveStage(index: number, direction: "up" | "down") {
    const updated = [...stages];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    setStages(updated.map((s, i) => ({ ...s, position: i })));
  }

  async function saveOrder() {
    setSaving(true);
    try {
      if (!supabase) return;
      for (const [i, s] of stages.entries()) {
        await supabase.from("pipeline_stages").update({ position: i }).eq("id", s.id);
      }
    } catch (err) {
      console.error("Failed to save order:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddStage() {
    if (!newStageName.trim()) {
      setAddError("Stage name is required.");
      return;
    }
    setAddError(null);
    setSaving(true);
    try {
      const slug = newStageName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const newPosition = stages.length;
      if (!supabase || !tenantId) return;
      const { data: newStage } = await supabase.from("pipeline_stages").insert({
        tenant_id: tenantId,
        name: newStageName.trim(),
        slug,
        color: newStageColor,
        position: newPosition,
        is_terminal: false,
      }).select("id").single();
      setStages((prev) => [
        ...prev,
        {
          id: newStage?.id ?? "",
          name: newStageName.trim(),
          slug,
          color: newStageColor,
          position: newPosition,
          isTerminal: false,
        },
      ]);
      setNewStageName("");
    } catch (err) {
      console.error("Failed to add stage:", err);
      setAddError("Failed to add stage. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingStages) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Pipeline Stages</h2>
          <button
            onClick={saveOrder}
            disabled={saving}
            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Order"}
          </button>
        </div>

        <div className="space-y-2">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className="flex items-center gap-3 px-3 py-3 border border-gray-100 rounded-lg"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <span className="flex-1 text-sm text-gray-900 font-medium">{stage.name}</span>
              {stage.isTerminal && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Terminal</span>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveStage(index, "up")}
                  disabled={index === 0}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  title="Move up"
                >
                  <ChevronUp size={14} className="text-gray-500" />
                </button>
                <button
                  onClick={() => moveStage(index, "down")}
                  disabled={index === stages.length - 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  title="Move down"
                >
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add New Stage</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Stage Name</label>
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g. Application Submitted"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Stage Color</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => setNewStageColor(c.value)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c.value,
                    borderColor: newStageColor === c.value ? "#1A5653" : "transparent",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {addError && <p className="mt-3 text-xs text-destructive">{addError}</p>}

        <div className="mt-5">
          <button
            onClick={handleAddStage}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold py-2.5 px-5 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            <Plus size={15} />
            Add Stage
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab({ userId, initial }: {
  userId: string;
  initial: NotificationPreferences;
}) {
  const supabase = useSupabase();
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(field: keyof NotificationPreferences, value: boolean) {
    setPrefs((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    try {
      await supabase.from("users").update({
        notification_preferences: prefs,
      } as Record<string, unknown>).eq("id", userId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-[12px] p-5 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Email Notifications</h2>
        <p className="text-xs text-gray-500 mb-4">Choose which events trigger an email to you.</p>

        <ToggleSwitch
          checked={prefs.reminders}
          onChange={(v) => setField("reminders", v)}
          label="Follow-up Reminders"
          description="Get emailed when a scheduled follow-up is due."
        />
        <ToggleSwitch
          checked={prefs.assignments}
          onChange={(v) => setField("assignments", v)}
          label="Lead Assignments"
          description="Receive a notification when a new lead is assigned to you."
        />
        <ToggleSwitch
          checked={prefs.stageChanges}
          onChange={(v) => setField("stageChanges", v)}
          label="Stage Changes"
          description="Be notified whenever one of your leads moves to a new pipeline stage."
        />

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <div className="mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold py-2.5 px-5 rounded-lg text-sm hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saved ? (
              <Check size={15} />
            ) : null}
            {saved ? "Saved!" : saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdminOrManager = user.role === "admin" || user.role === "manager";

  const visibleTabs = TAB_ITEMS.filter(
    (t) => t.id !== "pipeline" || isAdminOrManager
  );

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "profile" && (
        <ProfileTab
          userId={user.id}
          initialName={user.fullName ?? ""}
          email={user.email ?? ""}
          initialPhone={user.phone ?? ""}
        />
      )}

      {activeTab === "pipeline" && isAdminOrManager && <PipelineTab />}

      {activeTab === "notifications" && (
        <NotificationsTab
          userId={user.id}
          initial={
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (user as any).notificationPreferences ?? {
              reminders: true,
              assignments: true,
              stageChanges: false,
            }
          }
        />
      )}
    </div>
  );
}
