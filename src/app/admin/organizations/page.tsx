"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Send, ShieldCheck, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ProvisionRow {
  id: string;
  domain: string;
  normalized_domain: string;
  company_name: string;
  org_poc_name: string;
  org_poc_email: string;
  status: "provisioned" | "claimed" | "disabled";
  invited_at: string | null;
  claimed_at: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<ProvisionRow["status"], string> = {
  provisioned: "bg-blue-50 text-blue-700",
  claimed: "bg-green-50 text-green-700",
  disabled: "bg-gray-100 text-gray-500",
};

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ProvisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    domain: "",
    companyName: "",
    orgPocName: "",
    orgPocEmail: "",
  });

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.replace("/login?redirect=/admin/organizations");
      return;
    }

    const res = await fetch("/api/admin/organization-provisions", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Unable to load provisions.");
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.replace("/login?redirect=/admin/organizations");
        return;
      }

      const res = await fetch("/api/admin/organization-provisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Unable to provision organization.");

      setForm({ domain: "", companyName: "", orgPocName: "", orgPocEmail: "" });
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to provision organization.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProvision(id: string, action: "resend" | "disable") {
    setError(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      router.replace("/login?redirect=/admin/organizations");
      return;
    }

    const res = await fetch("/api/admin/organization-provisions", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Unable to update provision.");
      return;
    }
    await loadRows();
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
              <ArrowLeft size={15} />
              Back
            </Link>
            <div className="mt-3 flex items-center gap-2">
              <ShieldCheck size={22} className="text-primary" />
              <h1 className="text-xl font-bold text-gray-900">Organization Provisioning</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={loadRows}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white rounded-[12px] border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900">Provision an organization</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Approved email domain</span>
              <input
                value={form.domain}
                onChange={(e) => set("domain", e.target.value)}
                required
                placeholder="firm.co.uk"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Company</span>
              <input
                value={form.companyName}
                onChange={(e) => set("companyName", e.target.value)}
                required
                placeholder="Acme Mortgages"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Org PoC name</span>
              <input
                value={form.orgPocName}
                onChange={(e) => set("orgPocName", e.target.value)}
                required
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Org PoC email</span>
              <input
                type="email"
                value={form.orgPocEmail}
                onChange={(e) => set("orgPocEmail", e.target.value)}
                required
                placeholder="jane@firm.co.uk"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                <Send size={15} />
                {saving ? "Provisioning..." : "Provision and Send Invite"}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white rounded-[12px] border border-gray-100 shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-bold text-gray-900">Provisioned organizations</h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-400">No organizations provisioned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-3">Company</th>
                    <th className="px-5 py-3">Domain</th>
                    <th className="px-5 py-3">Org PoC</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Sent</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-5 py-3 font-semibold text-gray-900">{row.company_name}</td>
                      <td className="px-5 py-3 text-gray-600">{row.normalized_domain}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{row.org_poc_name}</p>
                        <p className="text-xs text-gray-500">{row.org_poc_email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[row.status]}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {row.invited_at ? new Date(row.invited_at).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={row.status !== "provisioned"}
                            onClick={() => updateProvision(row.id, "resend")}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            disabled={row.status !== "provisioned"}
                            onClick={() => updateProvision(row.id, "disable")}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <XCircle size={13} />
                            Disable
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
