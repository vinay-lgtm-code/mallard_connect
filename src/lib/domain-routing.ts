export function getMarketingHomeRedirectUrl(
  requestUrl: URL,
  requestHost: string | null,
  requestMethod: string,
  appDomain: string,
  marketingDomain: string,
): URL | null {
  const hostname = requestHost?.split(":")[0].toLowerCase();
  const method = requestMethod.toUpperCase();

  if (
    requestUrl.pathname !== "/" ||
    hostname !== appDomain.toLowerCase() ||
    (method !== "GET" && method !== "HEAD")
  ) {
    return null;
  }

  // Cross-origin policy: never forward app query parameters or fragments.
  // The explicit empty fragment prevents browsers inheriting the old fragment.
  return new URL(`https://${marketingDomain}/#`);
}
