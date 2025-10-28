import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { auth } from '@/lib/auth/better';
import { defaultLocale, locales, type Locale } from '@/src/i18n/config';

const protectedRoutes = ['/dashboard'];

const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'always',
});

function extractPathWithoutLocale(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return '/';
  }

  segments.shift();
  return `/${segments.join('/')}`;
}

function resolveLocaleFromPath(pathname: string): Locale {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (segment && locales.includes(segment as Locale)) {
    return segment as Locale;
  }

  return defaultLocale;
}

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);

  if (intlResponse.headers.has('location')) {
    return intlResponse;
  }

  const pathname = request.nextUrl.pathname;
  const locale = resolveLocaleFromPath(pathname);
  const normalizedPath = extractPathWithoutLocale(pathname);
  const isProtectedRoute = protectedRoutes.some((route) =>
    normalizedPath.startsWith(route)
  );

  let sessionHeaders: Headers | null = null;
  let sessionPayload: unknown = null;

  try {
    const sessionResult = (await auth.api.getSession({
      headers: request.headers,
      returnHeaders: true,
    })) as unknown as { headers?: Headers; response?: unknown };

    sessionHeaders = sessionResult?.headers ?? null;
    sessionPayload = sessionResult?.response ?? sessionResult ?? null;
  } catch (error) {
    console.error('Failed to validate session via Better Auth', error);
  }

  const hasSession = Boolean((sessionPayload as any)?.session);

  if (isProtectedRoute && !hasSession) {
    const redirectUrl = new URL(`/${locale}/sign-in`, request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);

    const setCookieHeader = sessionHeaders?.get('set-cookie');
    if (setCookieHeader) {
      redirectResponse.headers.set('set-cookie', setCookieHeader);
    }

    return redirectResponse;
  }

  const response = intlResponse ?? NextResponse.next();
  const setCookieHeader = sessionHeaders?.get('set-cookie');
  if (setCookieHeader) {
    response.headers.set('set-cookie', setCookieHeader);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|site.webmanifest|robots.txt).*)',
  ],
  runtime: 'nodejs',
};
