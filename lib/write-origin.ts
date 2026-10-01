export function allowedWriteOrigin(requestUrl: string, origin: string | null, configured = '') {
  if (!origin) return true;
  const allowed = [new URL(requestUrl).origin];
  for (const value of configured.split(',')) {
    try {
      const url = new URL(value.trim());
      if (url.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password)
        allowed.push(url.origin);
    } catch { /* Invalid configuration never grants access. */ }
  }
  return allowed.includes(origin);
}
