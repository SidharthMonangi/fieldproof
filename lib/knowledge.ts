export type Article = {
  id: string;
  title: string;
  body: string;
  category: string;
  version: number;
  updatedAt: string;
  sample: number;
};
export const sampleArticles = [
  {
    title: 'Preparing a complete field case',
    category: 'Fieldwork',
    body: 'Sample FieldProof procedure, not a lender policy. Record the applicant name, contact number, property location, loan purpose, requested amount and monthly income. Obtain consent before collecting evidence. Attach identity, income and property evidence plus a property photograph. Complete a visit with the applicant met and address confirmed. A reviewer checks evidence completeness; this is not a credit approval.',
  },
  {
    title: 'Working with unreliable connectivity',
    category: 'Fieldwork',
    body: 'FieldProof saves queued changes and attachments in this browser on this device. Open and sync the workspace before travelling. Saving locally is not the same as submitting to the reviewer. Reconnect and open Sync centre to check completion. Do not clear browser storage while work is pending. If a conflict appears, compare your local proposal with the server version before choosing to retry or discard it. Protect the device and sign out when handing it to another person.',
  },
  {
    title: 'Consent and evidence handling',
    category: 'Evidence',
    body: 'Sample guidance, not legal advice or a company policy. Explain what you collect and why before recording consent. Collect only the evidence required for the case. Do not upload Aadhaar numbers or sensitive real customer documents into this portfolio workspace. Record observations accurately and avoid assumptions. A document upload does not establish authenticity. Refer uncertainty to a qualified reviewer.',
  },
  {
    title: 'Reviewer responsibilities',
    category: 'Review',
    body: 'Sample FieldProof procedure. Review only submitted cases. Check evidence completeness, visit observations and discrepancies. Request changes with a specific written explanation when information is missing or inconsistent. Mark evidence verified only when the configured checklist is complete. Evidence verification does not approve a loan, establish ownership or certify structural safety. The activity timeline records the actor, time and review explanation.',
  },
  {
    title: 'Sustainable-home questions to escalate',
    category: 'Housing',
    body: 'Sample conversation guide. Ask about daylight, ventilation, heat, water access and locally available materials. Record the household priorities and budget. Material choice, structural design and suitability depend on location and professional assessment. Do not invent material prices, certify a design or recommend structural changes. Refer design and safety questions to a qualified architect or engineer.',
  },
];
const stop = new Set(
  'the a an is are to of for and or in on it my what how do does can i me we this that with should please'.split(
    ' ',
  ),
);
export function words(s: string) {
  return [...new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter(
    (w) => w.length > 2 && !stop.has(w),
  );
}
export function retrieve(question: string, articles: Article[], limit = 3) {
  const tokens = words(question);
  return articles
    .map((a) => {
      const title = words(a.title + ' ' + a.category);
      const body = words(a.body);
      return {
        article: a,
        score: tokens.reduce(
          (s, t) => s + (title.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0),
          0,
        ),
      };
    })
    .filter((r) => r.score >= 2)
    .sort((a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id))
    .slice(0, limit)
    .map((r) => r.article);
}
