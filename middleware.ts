import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'daymark_auth';

async function tokenFor(password: string) {
  const data = new TextEncoder().encode(`daymark:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    // Never leave a deployed site open by accident.
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return new NextResponse('DASHBOARD_PASSWORD is not set.', { status: 503 });
  }

  const cookie = req.cookies.get(COOKIE)?.value;
  if (cookie && cookie === (await tokenFor(password))) return NextResponse.next();

  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
};