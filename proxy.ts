import { NextResponse } from 'next/server';
import { securityHeaders } from './lib/security-headers';

// next.config headers() are skipped for prerendered pages served from cache (such
// as "/"), so the proxy adds the same headers to every response.
export function proxy() {
  const response = NextResponse.next();
  for (const { key, value } of securityHeaders) response.headers.set(key, value);
  return response;
}
