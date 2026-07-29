export function getMarketingHomeRedirectUrl(
  requestUrl: URL,
  requestHost: string | null,
  appDomain: string,
  marketingDomain: string,
): URL | null {
  const hostname = requestHost?.split(":")[0].toLowerCase();

  if (
    requestUrl.pathname !== "/" ||
    hostname !== appDomain.toLowerCase()
  ) {
    return null;
  }

  const marketingUrl = new URL(requestUrl);
  marketingUrl.protocol = "https:";
  marketingUrl.hostname = marketingDomain;
  marketingUrl.port = "";
  marketingUrl.hash = "";
  return marketingUrl;
}
