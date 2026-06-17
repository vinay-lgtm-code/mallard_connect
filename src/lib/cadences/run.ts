import { createServiceClient } from "@/lib/supabase/server";
import { sendCadenceEmail } from "@/lib/email/client";
import { renderTemplate } from "@/lib/email/render";
import type { CadenceStep } from "@/types";

interface StepResult {
  enrollmentId: string;
  cadenceName: string;
  channel: string;
  ok: boolean;
  error?: string;
}

export async function runDueCadenceSteps(): Promise<{
  processed: number;
  errors: number;
  log: StepResult[];
}> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: enrollments, error: fetchErr } = await supabase
    .from("cadence_enrollments")
    .select("id, tenant_id, lead_id, cadence_id, current_step")
    .eq("status", "active")
    .lte("next_run_at", now)
    .limit(200);

  if (fetchErr) throw new Error(`Failed to fetch enrollments: ${fetchErr.message}`);
  if (!enrollments || enrollments.length === 0) {
    return { processed: 0, errors: 0, log: [] };
  }

  const cadenceCache = new Map<string, { name: string; steps: CadenceStep[] }>();
  const templateCache = new Map<string, { subject?: string; body: string }>();
  const log: StepResult[] = [];
  let processed = 0;
  let errors = 0;

  for (const enrollment of enrollments) {
    const { id: enrollmentId, tenant_id, lead_id, cadence_id, current_step } = enrollment;

    try {
      if (!cadenceCache.has(cadence_id)) {
        const { data: cad } = await supabase
          .from("cadences")
          .select("name, steps")
          .eq("id", cadence_id)
          .eq("tenant_id", tenant_id)
          .single();
        if (!cad) throw new Error(`Cadence ${cadence_id} not found`);
        cadenceCache.set(cadence_id, { name: cad.name, steps: cad.steps as CadenceStep[] });
      }

      const cadence = cadenceCache.get(cadence_id)!;

      const { data: lead } = await supabase
        .from("leads")
        .select("first_name, last_name, email, phone, assigned_to")
        .eq("id", lead_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (!lead) {
        await supabase.rpc("advance_cadence_step", {
          p_enrollment_id: enrollmentId,
          p_expected_step: current_step,
          p_next_step: current_step,
          p_is_completed: true,
        });
        continue;
      }

      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenant_id)
        .single();

      let adviserName = "";
      if (lead.assigned_to) {
        const { data: adviser } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", lead.assigned_to)
          .eq("tenant_id", tenant_id)
          .single();
        adviserName = adviser?.full_name ?? "";
      }

      const context: Record<string, string> = {
        firstName: lead.first_name ?? "",
        lastName: lead.last_name ?? "",
        adviser: adviserName,
        firmName: tenant?.name ?? "",
      };

      let stepIdx = current_step;
      let continueProcessing = true;

      while (continueProcessing) {
        const step = cadence.steps[stepIdx];

        if (!step) {
          await supabase.rpc("advance_cadence_step", {
            p_enrollment_id: enrollmentId,
            p_expected_step: stepIdx,
            p_next_step: stepIdx,
            p_is_completed: true,
          });
          break;
        }

        if (step.templateId) {
          if (!templateCache.has(step.templateId)) {
            const { data: tpl } = await supabase
              .from("templates")
              .select("subject, body")
              .eq("id", step.templateId)
              .eq("tenant_id", tenant_id)
              .single();
            if (tpl) templateCache.set(step.templateId, { subject: tpl.subject ?? undefined, body: tpl.body });
          }
        }

        const template = step.templateId ? templateCache.get(step.templateId) : null;
        const subject = renderTemplate(step.subject ?? template?.subject ?? cadence.name, context);
        const body = renderTemplate(template?.body ?? step.body ?? "", context);
        const prospectName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();

        // Compute next state before executing
        const nextStepIdx = stepIdx + 1;
        const isCompleted = nextStepIdx >= cadence.steps.length;
        const nextDelay = isCompleted ? 0 : cadence.steps[nextStepIdx].delayDays;
        const nextRunAt = isCompleted
          ? null
          : nextDelay === 0
            ? new Date().toISOString()
            : new Date(Date.now() + nextDelay * 24 * 60 * 60 * 1000).toISOString();

        // Atomically advance enrollment before executing (claim-before-execute)
        const { data: claimed } = await supabase.rpc("advance_cadence_step", {
          p_enrollment_id: enrollmentId,
          p_expected_step: stepIdx,
          p_next_step: isCompleted ? stepIdx : nextStepIdx,
          p_next_run_at: nextRunAt,
          p_is_completed: isCompleted,
        });

        if (!claimed) break;

        await executeStep(supabase, {
          channel: step.channel,
          tenantId: tenant_id,
          leadId: lead_id,
          assignedTo: lead.assigned_to,
          email: lead.email,
          subject,
          body,
          prospectName,
          cadenceName: cadence.name,
          idempotencyKey: `cadence-step:${enrollmentId}:${stepIdx}`,
        });

        await supabase.from("activities").insert({
          tenant_id,
          lead_id,
          performed_by: lead.assigned_to,
          activity_type: step.channel === "email" ? "email" : step.channel === "sms" ? "sms" : "note",
          title: prospectName,
          description: `[Cadence: ${cadence.name}] ${subject}`,
        });

        processed++;
        log.push({ enrollmentId, cadenceName: cadence.name, channel: step.channel, ok: true });

        if (!isCompleted && nextDelay === 0) {
          stepIdx = nextStepIdx;
        } else {
          continueProcessing = false;
        }
      }
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      log.push({ enrollmentId, cadenceName: "unknown", channel: "unknown", ok: false, error: msg });
    }
  }

  return { processed, errors, log };
}

async function executeStep(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    channel: string;
    tenantId: string;
    leadId: string;
    assignedTo: string | null;
    email: string | null;
    subject: string;
    body: string;
    prospectName: string;
    cadenceName: string;
    idempotencyKey: string;
  },
) {
  const { channel, tenantId, leadId, assignedTo, email, subject, body, prospectName, cadenceName, idempotencyKey } = params;

  switch (channel) {
    case "email": {
      if (!email) {
        await createTaskFallback(supabase, {
          tenantId,
          leadId,
          assignedTo,
          title: `[${cadenceName}] Email not sent — no email address`,
          description: `Cadence wanted to send "${subject}" but this lead has no email. Please reach out manually.`,
        });
        return;
      }
      await sendCadenceEmail({
        to: email,
        subject,
        body,
        leadUrl: "",
        idempotencyKey,
      });
      return;
    }

    case "sms": {
      await createTaskFallback(supabase, {
        tenantId,
        leadId,
        assignedTo,
        title: `[${cadenceName}] Send text to ${prospectName}`,
        description: body || subject,
      });
      return;
    }

    case "task":
    case "reminder": {
      await createTaskFallback(supabase, {
        tenantId,
        leadId,
        assignedTo,
        title: `[${cadenceName}] ${subject}`,
        description: body || null,
      });
      return;
    }
  }
}

async function createTaskFallback(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    tenantId: string;
    leadId: string;
    assignedTo: string | null;
    title: string;
    description: string | null;
  },
) {
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("tasks").insert({
    tenant_id: params.tenantId,
    lead_id: params.leadId,
    assigned_to: params.assignedTo,
    created_by: params.assignedTo,
    title: params.title,
    description: params.description,
    due_date: dueDate,
    priority: "normal",
  });
}
