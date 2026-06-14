import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getServerBackendUrl } from '@/lib/apiClient';

const OSS_TOKEN_COOKIE = 'dograh_auth_token';
const ORG_SLUG_COOKIE = 'org_slug';

// Paths that don't require authentication in OSS mode
const PUBLIC_PATHS = ['/auth/login', '/auth/signup'];

// Bare org routes now live under /[slug]/* — middleware redirects these to the
// slugged URL using the active-workspace cookie.
const ORG_ROUTES = new Set([
  'overview',
  'workflow',
  'campaigns',
  'recordings',
  'reports',
  'tools',
  'telephony-configurations',
  'model-configurations',
  'automation',
  'files',
  'api-keys',
  'usage',
  'settings',
]);

let cachedAuthProvider: string | null = null;

async function fetchAuthProvider(): Promise<string> {
  if (cachedAuthProvider) {
    return cachedAuthProvider;
  }

  try {
    const backendUrl = getServerBackendUrl();
    const res = await fetch(`${backendUrl}/api/v1/health`);
    if (res.ok) {
      const data = await res.json();
      cachedAuthProvider = (data.auth_provider as string) || 'local';
      return cachedAuthProvider;
    }
  } catch {
    // Backend not reachable — fall back to local
  }

  cachedAuthProvider = 'local';
  return cachedAuthProvider;
}

export async function middleware(request: NextRequest) {
  const authProvider = await fetchAuthProvider();

  // Only handle OSS mode
  if (authProvider !== 'local') {
    return NextResponse.next();
  }

  const token = request.cookies.get(OSS_TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  // Allow public paths without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // If no token, redirect to login
  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ── Multi-tenant slug routing ──────────────────────────────────────────
  const slug = request.cookies.get(ORG_SLUG_COOKIE)?.value;
  const first = pathname.split('/').filter(Boolean)[0] ?? '';

  // A bare org route (e.g. /workflow) → redirect to /{slug}/workflow.
  if (slug && ORG_ROUTES.has(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Root → the active workspace; if we don't know the slug yet, let
  // /after-sign-in resolve it.
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = slug ? `/${slug}/overview` : '/after-sign-in';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
