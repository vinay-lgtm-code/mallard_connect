// Variable interpolation for email/SMS templates.
// Replaces {{variable}} tokens with values from the context object.

export function renderTemplate(body: string, context: Record<string, string | number | undefined>): string {
  return body.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => {
    const value = context[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function extractVariables(text: string): string[] {
  const matches = text.matchAll(/{{\s*(\w+)\s*}}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}
