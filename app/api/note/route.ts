// Save as app/api/note/route.ts
// Needs: npm i @upstash/redis
// Env:   NOTE_KEY (the passcode you type once per device)
//        UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or the KV_REST_API_URL / KV_REST_API_TOKEN names
//        that Vercel's Upstash integration adds; both are read below)
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic'; // never cache: the iPad has to see new notes

const KEY = 'daymark:note';
const MAX_LEN = 140;
const COLORS = ['yellow', 'pink', 'blue', 'green', 'lilac'];
const MAX_MINUTES = 60 * 24 * 7;

type Note = { id: number; text: string; color: string; expiresAt: number };

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const headers = { 'cache-control': 'no-store' };
const authed = (req: Request) => !!process.env.NOTE_KEY && req.headers.get('x-note-key') === process.env.NOTE_KEY;

export async function GET() {
  try {
    const note = redis ? await redis.get<Note>(KEY) : null;
    // Redis drops the key at expiry; the extra check covers clock skew
    return Response.json({ note: note && note.expiresAt > Date.now() ? note : null }, { headers });
  } catch {
    return Response.json({ note: null }, { headers }); // never break the dashboard over a note
  }
}

export async function POST(req: Request) {
  if (!process.env.NOTE_KEY || !redis) return new Response('Notes are not configured', { status: 503 });
  if (!authed(req)) return new Response('Unauthorized', { status: 401 });

  let body: { text?: unknown; color?: unknown; minutes?: unknown };
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const text = String(body.text ?? '').trim().slice(0, MAX_LEN);
  if (!text) return new Response('Empty note', { status: 400 });
  const color = COLORS.includes(String(body.color)) ? String(body.color) : 'yellow';
  const minutes = Math.min(Math.max(Number(body.minutes) || 60, 1), MAX_MINUTES);

  const ttl = Math.round(minutes * 60);
  const note: Note = { id: Date.now(), text, color, expiresAt: Date.now() + ttl * 1000 };
  await redis.set(KEY, note, { ex: ttl }); // EX makes Redis delete it for us when time is up
  return Response.json({ note }, { headers });
}

export async function DELETE(req: Request) {
  if (!process.env.NOTE_KEY || !redis) return new Response('Notes are not configured', { status: 503 });
  if (!authed(req)) return new Response('Unauthorized', { status: 401 });
  await redis.del(KEY);
  return Response.json({ ok: true }, { headers });
}