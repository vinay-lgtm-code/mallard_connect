export const IMPORT_TARGET_FIELDS = [
  { value: "", label: "-- Skip --" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "name", label: "Full Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "source", label: "Lead Source" },
  { value: "assignedTo", label: "Assigned To" },
  { value: "currentStage", label: "Pipeline Stage" },
  { value: "status", label: "Status" },
  { value: "mortgageType", label: "Mortgage Type" },
  { value: "readiness", label: "Readiness" },
  { value: "propertyValue", label: "Property Value" },
  { value: "depositAmount", label: "Deposit Amount" },
  { value: "loanAmount", label: "Loan Amount" },
  { value: "dealValue", label: "Deal Value" },
  { value: "estimatedCloseDate", label: "Estimated Close Date" },
  { value: "confidence", label: "Confidence" },
  { value: "factFindDate", label: "Fact Find Date" },
  { value: "notes", label: "Case Notes" },
  { value: "createdAt", label: "Date Added" },
  { value: "referredBy", label: "Referred By" },
  { value: "nextFollowUpDate", label: "Next Follow-up Date" },
  { value: "followUpReason", label: "Follow-up Reason" },
] as const;

export const AUTO_MAP_PATTERNS: Array<{ patterns: string[]; field: string }> = [
  { patterns: ["first name", "firstname"], field: "firstName" },
  { patterns: ["last name", "lastname", "surname"], field: "lastName" },
  { patterns: ["client", "client name", "name", "full name", "customer", "borrower"], field: "name" },
  { patterns: ["tel number", "phone", "mobile", "telephone", "phone number", "contact number"], field: "phone" },
  { patterns: ["email address", "email", "e-mail"], field: "email" },
  { patterns: ["adviser", "advisor", "advisor name", "adviser name", "broker", "broker name", "assigned to", "assignee", "owner", "consultant"], field: "assignedTo" },
  { patterns: ["case status", "status", "lead status"], field: "status" },
  { patterns: ["stage", "pipeline stage", "current stage"], field: "currentStage" },
  { patterns: ["source", "lead source", "enquiry source", "referral source"], field: "source" },
  { patterns: ["date", "created", "created at", "date added", "lead date", "enquiry date"], field: "createdAt" },
  { patterns: ["type", "mortgage type", "product type", "case type"], field: "mortgageType" },
  { patterns: ["readiness", "lead readiness"], field: "readiness" },
  { patterns: ["property value", "purchase price", "property price"], field: "propertyValue" },
  { patterns: ["deposit", "deposit amount"], field: "depositAmount" },
  { patterns: ["loan amount", "mortgage amount", "borrowing"], field: "loanAmount" },
  { patterns: ["deal value", "fee", "revenue", "gross fee"], field: "dealValue" },
  { patterns: ["estimated close date", "close date", "expected close", "completion forecast"], field: "estimatedCloseDate" },
  { patterns: ["confidence", "probability", "chance"], field: "confidence" },
  { patterns: ["fact find date", "ff date", "fact find"], field: "factFindDate" },
  { patterns: ["case updates", "case update", "notes", "case notes", "comments"], field: "notes" },
  { patterns: ["referred by", "referral", "referrer"], field: "referredBy" },
  { patterns: ["next follow up", "follow up date", "follow-up date", "next follow-up date"], field: "nextFollowUpDate" },
  { patterns: ["follow up reason", "follow-up reason"], field: "followUpReason" },
];

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/\u00a0/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function autoMapColumns(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    for (const { patterns, field } of AUTO_MAP_PATTERNS) {
      if (patterns.includes(normalized)) {
        result[header] = field;
        break;
      }
    }
  }

  return result;
}

export function normalizeMortgageType(raw: string): string {
  const map: Record<string, string> = {
    ftb: "first-time-buyer",
    "first time buyer": "first-time-buyer",
    "first-time buyer": "first-time-buyer",
    "first-time-buyer": "first-time-buyer",
    "ftb purchase": "first-time-buyer",
    btl: "buy-to-let",
    buy2let: "buy-to-let",
    "buy to let": "buy-to-let",
    "buy-to-let": "buy-to-let",
    remo: "remortgage",
    "hmo remo": "remortgage",
    remortgage: "remortgage",
    "remo ltd cp": "remortgage",
    "self employed": "self-employed",
    "self-employed": "self-employed",
    purchase: "other",
    purchaser: "other",
    flips: "other",
  };
  return map[raw.toLowerCase().trim()] ?? "other";
}
