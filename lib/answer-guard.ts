// Generated answer text is free-form even when its citations are verified. Links,
// email addresses and phone numbers are the parts a manipulated passage would use to
// redirect a reader, so each one must appear verbatim in the cited sources.
const references = [
  /\bhttps?:\/\/[^\s<>"')\]]+/gi,
  /\bwww\.[^\s<>"')\]]+/gi,
  /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
  /\+?\d[\d ()-]{7,}\d/g,
];

export function unsupportedReferences(answer: string, sources: string[]) {
  const corpus = sources.join('\n').toLowerCase();
  const found = references.flatMap((pattern) => answer.match(pattern) ?? []);
  return [...new Set(found.map((value) => value.replace(/[.,;:!?]+$/, '')))].filter(
    (value) => !corpus.includes(value.toLowerCase()),
  );
}
