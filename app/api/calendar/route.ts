import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean; calendarIndex: number };

export async function GET() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const calendarIds = (process.env.GOOGLE_CALENDAR_IDS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Not set up yet: the dashboard falls back to sample events.
  if (!email || !key || calendarIds.length === 0) {
    return NextResponse.json({ configured: false, events: [] });
  }

  try {
    const auth = new google.auth.JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });
    const calendar = google.calendar({ version: 'v3', auth });

    // Start a day early so events in timezones ahead of the server are not missed.
    const timeMin = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

    const results = await Promise.allSettled(
      calendarIds.map(async (calendarId, calendarIndex): Promise<CalEvent[]> => {
        const res = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 100,
        });
        return (res.data.items ?? [])
          .filter(e => e.status !== 'cancelled')
          .map(e => ({
            id: `${calendarIndex}-${e.id}`,
            title: e.summary ?? 'Busy',
            start: e.start?.dateTime ?? e.start?.date ?? '',
            end: e.end?.dateTime ?? e.end?.date ?? '',
            allDay: !e.start?.dateTime,
            calendarIndex,
          }))
          .filter(e => e.start);
      }),
    );

    const events = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    // If every calendar failed, report an error so the dashboard keeps its last good data.
    if (results.every(r => r.status === 'rejected')) {
      return NextResponse.json({ configured: true, error: 'Could not read calendars' }, { status: 502 });
    }

    return NextResponse.json(
      { configured: true, events },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
    );
  } catch {
    return NextResponse.json({ configured: true, error: 'Calendar request failed' }, { status: 502 });
  }
}