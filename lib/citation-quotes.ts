// These are choices, not generated quotations. Keep every choice a literal substring.
export function citationQuotes(body: string) {
  const sentences = body
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
  const choices = sentences.slice(0, 24).map((s) => s.slice(0, 400));
  return choices.length ? [...new Set(choices)] : [body.slice(0, 400)];
}
