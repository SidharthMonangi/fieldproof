import type { Article } from './knowledge';
export function sourceMetadata(article: Article) {
  const match = article.body.match(/^Source: (https:\/\/[^\s]+)$/m);
  if (!match) return undefined;
  let url: URL;
  try {
    url = new URL(match[1]);
  } catch {
    return undefined;
  }
  if (
    url.username ||
    url.password ||
    url.port ||
    !['www.pib.gov.in', 'pib.gov.in', 'saathee.beeindia.gov.in'].includes(url.hostname)
  )
    return undefined;
  const published = article.body.match(/^Published: (.+)$/m)?.[1];
  const fetched = article.body.match(/^Fetched: (.+)$/m)?.[1];
  const publisher = article.body.match(/Publisher: ([^\n]+)/)?.[1] || url.hostname;
  return {
    url: url.href,
    publisher,
    published,
    fetched,
    snapshot: !fetched,
    content:
      article.body
        .split('Extracted paragraphs (may be truncated; read the original):\n\n')[1]
        ?.split('\n\nConfirm current requirements')[0] ||
      article.body.split('\n\n')[1] ||
      '',
    stale: !fetched || Date.now() - Date.parse(fetched) > 7 * 86400000,
  };
}
export function stableSourceBody(body: string) {
  return body.replace(/^Fetched: .*\n/m, '');
}
