import assert from "node:assert/strict";
import test from "node:test";
import { getMarketingHomeRedirectUrl } from "../src/lib/domain-routing.ts";

const APP_DOMAIN = "app.sequence-ai.com";
const MARKETING_DOMAIN = "www.sequence-ai.com";

test("GET app homepage resolves to the current marketing homepage", () => {
  const redirect = getMarketingHomeRedirectUrl(
    new URL("https://app.sequence-ai.com/?campaign=digest#old-section"),
    "app.sequence-ai.com",
    "GET",
    APP_DOMAIN,
    MARKETING_DOMAIN,
  );

  assert.equal(redirect?.toString(), "https://www.sequence-ai.com/#");
});

test("HEAD app homepage resolves to the current marketing homepage", () => {
  const redirect = getMarketingHomeRedirectUrl(
    new URL("https://app.sequence-ai.com/"),
    "app.sequence-ai.com",
    "HEAD",
    APP_DOMAIN,
    MARKETING_DOMAIN,
  );

  assert.equal(redirect?.toString(), "https://www.sequence-ai.com/#");
});

test("non-idempotent methods are not sent to the marketing site", () => {
  assert.equal(
    getMarketingHomeRedirectUrl(
      new URL("https://app.sequence-ai.com/"),
      "app.sequence-ai.com",
      "POST",
      APP_DOMAIN,
      MARKETING_DOMAIN,
    ),
    null,
  );
});

test("app routes stay on the application domain", () => {
  assert.equal(
    getMarketingHomeRedirectUrl(
      new URL("https://app.sequence-ai.com/login"),
      "app.sequence-ai.com",
      "GET",
      APP_DOMAIN,
      MARKETING_DOMAIN,
    ),
    null,
  );
});

test("the marketing homepage does not redirect to itself", () => {
  assert.equal(
    getMarketingHomeRedirectUrl(
      new URL("https://www.sequence-ai.com/"),
      "www.sequence-ai.com",
      "GET",
      APP_DOMAIN,
      MARKETING_DOMAIN,
    ),
    null,
  );
});
