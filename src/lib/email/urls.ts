export function getDailyDigestLoginUrl(appUrl: string): string {
  return new URL("/login", appUrl).toString();
}
