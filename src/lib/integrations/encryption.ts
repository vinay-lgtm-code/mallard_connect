// At-rest encryption for third-party API keys (Brevo, etc.).
// Real implementation lands in step 9 (Brevo connector) — uses BREVO_ENCRYPTION_KEY.

export function encryptApiKey(plaintext: string): string {
  return plaintext;
}

export function decryptApiKey(ciphertext: string): string {
  return ciphertext;
}
