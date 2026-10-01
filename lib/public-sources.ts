export const publicSources = [
  {
    title: 'Housing update: September PMAY-U 2.0 sanctions',
    summary:
      'On 11 September 2026, MoHUA reported that total approved houses under PMAY-U 2.0 had reached 18.77 lakh after a Central Sanctioning and Monitoring Committee meeting. These are dated programme-wide figures, not approvals for an individual household.',
    publisher: 'Press Information Bureau / MoHUA',
    published: '2026-09-11',
    url: 'https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2309343&lang=1&reg=3',
    keyword: 'PMAY',
    category: 'Housing',
  },
  {
    title: 'Housing update: sustainable and disaster resilient housing',
    summary:
      'A MoHUA release dated 12 March 2026 describes the transition from PMAY-U to PMAY-U 2.0. Its programme context should be read alongside current scheme guidelines and applicable building requirements; it is not certification that a specific property is safe or sustainable.',
    publisher: 'Press Information Bureau / MoHUA',
    published: '2026-03-12',
    url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2239027&lang=1&reg=6',
    keyword: 'housing',
    category: 'Housing',
  },
  {
    title: 'Official update: PMAY-U 2.0 implementation',
    summary:
      'A PIB update dated 27 July 2026 describes PMAY-U 2.0 through four routes: beneficiary-led construction, housing in partnership, affordable rental housing and interest subsidy. State and local authorities validate beneficiaries against scheme criteria. This is a dated public update, not a determination of eligibility for an individual applicant.',
    publisher: 'Press Information Bureau / MoHUA',
    published: '2026-07-27',
    url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2289996&lang=1&reg=48',
    keyword: 'PMAY-U',
    category: 'Housing',
  },
  {
    title: 'Eco Niwas Samhita: building envelope guidance',
    summary:
      'BEE describes Eco Niwas Samhita as a residential energy-conservation code. Its building-envelope guidance addresses heat gain and heat loss, with natural ventilation and daylighting potential. Use the original code and qualified professional assessment to determine requirements for a specific building.',
    publisher: 'Bureau of Energy Efficiency',
    published: 'Publication date not supplied by this page',
    url: 'https://saathee.beeindia.gov.in/eco-niwas-samhita/',
    keyword: 'envelope',
    category: 'Housing',
  },
];
// Import short relevant paragraphs, never scripts or an entire publication.
export function sourceParagraphs(html: string, keyword: string) {
  const clean = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const paragraphs = [...clean.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&rsquo;|&lsquo;/g, "'")
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code: string) => {
          const value = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : Number(code);
          return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
        })
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((p) => p.length > 50 && p.toLowerCase().includes(keyword.toLowerCase()));
  return [...new Set(paragraphs)].slice(0, 3).join('\n\n').slice(0, 2400);
}
