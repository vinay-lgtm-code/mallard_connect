export type UserRole = "admin" | "manager" | "advisor" | "case_manager";

export type LeadSource =
  | "website"
  | "referral"
  | "phone"
  | "walk-in"
  | "social"
  | "mab-import"
  | "other";

export type MortgageType =
  | "first-time-buyer"
  | "remortgage"
  | "self-employed"
  | "buy-to-let"
  | "other";

export type Readiness =
  | "ready-now"
  | "1-3-months"
  | "3-6-months"
  | "6-12-months"
  | "exploring";

export type LeadStatus = "active" | "on-hold" | "lost" | "converted";

// Outcome snapshotted onto a lead when it closes (status -> converted | lost).
// Written by the `capture_confidence_at_close` BEFORE UPDATE trigger; see
// supabase/migrations/00006_forecast_accuracy.sql and
// docs/forecast-accuracy-data-model.md.
export type ClosedOutcome = "converted" | "lost";

export type ActivityType =
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "sms"
  | "whatsapp"
  | "stage-change";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskStatus = "pending" | "snoozed" | "completed" | "cancelled";

export interface PipelineStage {
  id: string;
  name: string;
  slug: string;
  position: number;
  color: string;
  isTerminal: boolean;
  expectedDays: number | null;
  amberPct: number;
}

export interface LeadStageHistory {
  id: string;
  leadId: string;
  stageId: string | null;
  stageSlug: string | null;
  enteredAt: string;
  exitedAt: string | null;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  currentStageId: string;
  currentStageEnteredAt: string | null;
  assignedTo: string;
  mortgageType: MortgageType | null;
  readiness: Readiness | null;
  propertyValue: number | null;
  depositAmount: number | null;
  loanAmount: number | null;
  dealValue: number | null;
  estimatedCloseDate: string | null;
  confidence: number | null;
  nextFollowUpDate: string | null;
  followUpReason: string | null;
  followUpNotes: string | null;
  tags: string[];
  referredBy: string | null;
  importId: string | null;
  createdAt: string;
  updatedAt: string;
  convertedAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  // Forecast-accuracy snapshot fields (data model only; feature parked).
  // Populated by the DB trigger when status transitions to converted/lost.
  // confidenceAtClose mirrors `confidence` (0-100) at close time;
  // closedOutcome mirrors the closing `status`.
  confidenceAtClose: number | null;
  closedOutcome: ClosedOutcome | null;
}

export interface Activity {
  id: string;
  leadId: string;
  performedBy: string;
  activityType: ActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Task {
  id: string;
  leadId: string;
  assignedTo: string;
  createdBy: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  reminderEmails: [string?, string?, string?];
  reminderSent: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

// ===== Tenant model =====

export type TenantPlan = "trial" | "base" | "growth";

export interface Tenant {
  id: string;
  name: string;
  slug: string; // vanity subdomain
  primaryColor?: string;
  logoUrl?: string;
  plan: TenantPlan;
  seatLimit: number;
  createdAt: string;
}

export interface SubdomainMapping {
  slug: string; // doc id
  tenantId: string;
}

// ===== Cadences =====

export type CadenceTriggerType = "stage_entered" | "manual" | "lead_created";
export type CadenceChannel = "email" | "sms" | "task" | "reminder";
export type CadenceEnrollmentStatus = "active" | "paused" | "completed" | "unsubscribed";

export interface CadenceTrigger {
  type: CadenceTriggerType;
  stageId?: string; // present when type === "stage_entered"
}

export interface CadenceStep {
  delayDays: number;
  channel: CadenceChannel;
  templateId?: string;
  subject?: string;
  body?: string;
}

export interface Cadence {
  id: string;
  name: string;
  description?: string;
  trigger: CadenceTrigger;
  steps: CadenceStep[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CadenceEnrollment {
  id: string;
  leadId: string;
  cadenceId: string;
  currentStep: number;
  nextRunAt: string | null;
  status: CadenceEnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
}

// ===== Templates =====

export type TemplateChannel = "email" | "sms";

export interface Template {
  id: string;
  name: string;
  channel: TemplateChannel;
  subject?: string;
  body: string;
  variables: string[];
  updatedAt: string;
}

// ===== Integrations =====

export type IntegrationProvider = "brevo" | "mab" | "other";
export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface Integration {
  provider: IntegrationProvider;
  apiKey?: string; // encrypted at rest
  listId?: string;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  errorMessage?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  reminders: boolean;
  assignments: boolean;
  stageChanges: boolean;
}

// ===== Documents =====

export type DocumentCategory =
  | "proof_of_id"
  | "proof_of_address"
  | "bank_statement"
  | "payslip"
  | "tax_return"
  | "credit_report"
  | "valuation"
  | "mortgage_offer"
  | "dip"
  | "insurance"
  | "other";

export interface Document {
  id: string;
  tenantId: string;
  leadId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  category: DocumentCategory;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== Document Requests =====

export type DocumentRequestStatus = "pending" | "completed" | "expired" | "cancelled";

export interface DocumentRequest {
  id: string;
  tenantId: string;
  leadId: string;
  requestedBy: string;
  leadEmail: string;
  requestedCategories: DocumentCategory[];
  message: string | null;
  status: DocumentRequestStatus;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportRecord {
  id: string;
  uploadedBy: string;
  fileName: string;
  columnMapping: Record<string, string>;
  stats: {
    total: number;
    imported: number;
    skipped: number;
    failed: number;
  };
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
}
