export type ImportRow = {
  rawData: Record<string, string>;
  mappedData: {
    name?: string;
    phone?: string;
    email?: string;
    [key: string]: string | undefined;
  };
  matchedLeadId?: string;
  matchType?: "phone" | "email" | "both" | "none";
};

export type DedupResult = {
  new: ImportRow[];
  duplicateSkip: ImportRow[];
  duplicateUpdate: ImportRow[];
};

type Lead = {
  id: string;
  phone?: string;
  email?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-()]/g, "");

  if (normalized.startsWith("+44")) {
    normalized = "0" + normalized.slice(3);
  } else if (normalized.startsWith("0044")) {
    normalized = "0" + normalized.slice(4);
  }

  if (!normalized.startsWith("0")) {
    normalized = "0" + normalized;
  }

  return normalized;
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function findDuplicates(incoming: ImportRow[], existing: Lead[]): DedupResult {
  const result: DedupResult = { new: [], duplicateSkip: [], duplicateUpdate: [] };

  const phoneIndex = new Map<string, Lead>();
  const emailIndex = new Map<string, Lead>();

  for (const lead of existing) {
    if (lead.phone) {
      phoneIndex.set(normalizePhone(lead.phone), lead);
    }
    if (lead.email) {
      emailIndex.set(normalizeEmail(lead.email), lead);
    }
  }

  for (const row of incoming) {
    const incomingPhone = row.mappedData.phone ? normalizePhone(row.mappedData.phone) : null;
    const incomingEmail = row.mappedData.email ? normalizeEmail(row.mappedData.email) : null;

    const phoneMatch = incomingPhone ? phoneIndex.get(incomingPhone) : undefined;
    const emailMatch = incomingEmail ? emailIndex.get(incomingEmail) : undefined;

    let matchedLead: Lead | undefined;
    let matchType: ImportRow["matchType"] = "none";

    if (phoneMatch && emailMatch && phoneMatch.id === emailMatch.id) {
      matchedLead = phoneMatch;
      matchType = "both";
    } else if (phoneMatch) {
      matchedLead = phoneMatch;
      matchType = "phone";
    } else if (emailMatch) {
      matchedLead = emailMatch;
      matchType = "email";
    }

    if (!matchedLead) {
      result.new.push({ ...row, matchType: "none" });
      continue;
    }

    const annotated: ImportRow = { ...row, matchedLeadId: matchedLead.id, matchType };

    const incomingUpdatedAt = row.mappedData.updatedAt;
    const existingUpdatedAt = matchedLead.updatedAt;

    const incomingIsNewer =
      incomingUpdatedAt && existingUpdatedAt
        ? new Date(incomingUpdatedAt) > new Date(existingUpdatedAt)
        : false;

    if (incomingIsNewer) {
      result.duplicateUpdate.push(annotated);
    } else {
      result.duplicateSkip.push(annotated);
    }
  }

  return result;
}
