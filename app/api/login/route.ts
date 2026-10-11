import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const sha256 = (s: string) => createHash('sha256').update(s).digest();

export async function POST(req: Request) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return NextResponse.json({ error: 'Password is not configured' }, { status: 503 });

  let password = '';
  try {
    const body = await req.json();
    if (typeof body.password === 'string') password = body.password;
  } catch { /* treat a bad body as a wrong password */ }

  if (!timingSafeEqual(sha256(password), sha256(expected))) {
    await new Promise(resolve => setTimeout(resolve, 800)); // slows down guessing
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('daymark_auth', sha256(`daymark:${expected}`).toString('hex'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // stays signed in on the iPad for a year
    path: '/',
  });
  return res;
}