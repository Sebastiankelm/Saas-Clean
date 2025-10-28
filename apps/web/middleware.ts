import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/better';

const protectedRoutes = ['/dashboard'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  let sessionHeaders: Headers | null = null;
  let sessionPayload: unknown = null;

  try {
    const sessionResult = (await auth.api.getSession({
      headers: request.headers,
      returnHeaders: true,
    })) as unknown as { headers?: Headers; response?: any };

    sessionHeaders = sessionResult?.headers ?? null;
    sessionPayload = sessionResult?.response ?? sessionResult ?? null;
  } catch (error) {
    console.error('Failed to validate session via Better Auth', error);
  }

  const hasSession = Boolean((sessionPayload as any)?.session);

  if (isProtectedRoute && !hasSession) {
    const redirectResponse = NextResponse.redirect(
      new URL('/sign-in', request.url)
    );

    const setCookieHeader = sessionHeaders?.get('set-cookie');
    if (setCookieHeader) {
      redirectResponse.headers.set('set-cookie', setCookieHeader);
    }

    return redirectResponse;
  }

  const response = NextResponse.next();
  const setCookieHeader = sessionHeaders?.get('set-cookie');
  if (setCookieHeader) {
    response.headers.set('set-cookie', setCookieHeader);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs'
};
