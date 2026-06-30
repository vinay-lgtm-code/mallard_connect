const DEFAULT_SEQUENCE_ADMIN_EMAILS = [
  "vinay@getlegaci.com",
  "divya@getlegaci.com",
  "vinay@sequence-ai.com",
  "divya@sequence-ai.com",
  "divyashankar@storyboarddigital.co.uk",
  "divya.shankar@storyboarddigital.co.uk",
];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function getEmailDomain(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalizeDomain(normalized.slice(at + 1));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function isValidDomain(domain: string): boolean {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalizeDomain(domain));
}

export function sequenceAdminEmails(): string[] {
  const raw = process.env.SEQUENCE_ADMIN_EMAILS;
  if (!raw) return DEFAULT_SEQUENCE_ADMIN_EMAILS;

  const parsed = raw
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_SEQUENCE_ADMIN_EMAILS;
}

export function isSequenceAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return sequenceAdminEmails().includes(normalizeEmail(email));
}
