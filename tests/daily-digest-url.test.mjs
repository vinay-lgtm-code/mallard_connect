import assert from "node:assert/strict";
import test from "node:test";
import { getDailyDigestLoginUrl } from "../src/lib/email/urls.ts";

test("daily prospect emails open the Sequence login page", () => {
  assert.equal(
    getDailyDigestLoginUrl("https://app.sequence-ai.com"),
    "https://app.sequence-ai.com/login",
  );
});

test("login replaces any path, query, or fragment from the configured app URL", () => {
  assert.equal(
    getDailyDigestLoginUrl("https://app.sequence-ai.com/dashboard?view=today#follow-ups"),
    "https://app.sequence-ai.com/login",
  );
});
