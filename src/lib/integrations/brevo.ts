// Brevo SDK wrapper. One-way pull only — never the email send engine.
// Filled in during step 9 (Brevo connector).

export async function validateBrevoApiKey(_apiKey: string): Promise<boolean> {
  return false;
}

export async function pullContactsForTenant(_tenantId: string): Promise<{ pulled: number }> {
  return { pulled: 0 };
}
