import { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "manager" | "advisor";

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
  assignedTo: string;
  mortgageType: MortgageType | null;
  readiness: Readiness | null;
  propertyValue: number | null;
  depositAmount: number | null;
  loanAmount: number | null;
  dealValue: number | null;
  estimatedCloseDate: Timestamp | null;
  confidence: number | null;
  nextFollowUpDate: Timestamp | null;
  followUpReason: string | null;
  followUpNotes: string | null;
  tags: string[];
  referredBy: string | null;
  importId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  convertedAt: Timestamp | null;
  lostAt: Timestamp | null;
  lostReason: string | null;
}

export interface Activity {
  id: string;
  leadId: string;
  performedBy: string;
  activityType: ActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Timestamp;
}

export interface Task {
  id: string;
  leadId: string;
  assignedTo: string;
  createdBy: string;
  title: string;
  description: string | null;
  dueDate: Timestamp | null;
  priority: TaskPriority;
  status: TaskStatus;
  reminderEmails: [string?, string?, string?];
  reminderSent: boolean;
  createdAt: Timestamp;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: Timestamp;
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
  createdAt: Timestamp;
}
