'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudRain, CloudDrizzle, CloudSnow, CloudFog, CloudLightning,
  ChevronLeft, ChevronRight, MapPin, Settings2, X, Check, Droplets, Droplet, Wind, Sunrise, Sunset, Search, Thermometer, Umbrella, Plus,
} from 'lucide-react';

/* ---------- types ---------- */
type Theme = 'forest' | 'midnight' | 'ember' | 'meadow' | 'paper' | 'eink';
type WeatherDay = { date: string; code: number; max: number; min: number; rain: number };
type Weather = {
  current: { temp: number; feels: number; humidity: number; wind: number; code: number; isDay: boolean };
  days: WeatherDay[];
  sunrise: string;
  sunset: string;
};
type CalEvent = { id: string; title: string; start: string; end: string; allDay: boolean; calendarIndex: number };

/* ---------- constants ---------- */
const SETTINGS_KEY = 'daymark-settings-v2';
const EPOCH = new Date(0);
const RAIN_HINT_PCT = 50; // show the umbrella at or above this chance of rain today

/* sticky note: one shared note, stored by /api/note and polled by every device */
const NOTE_KEY_STORAGE = 'daymark-note-key';
const NOTE_SEEN_STORAGE = 'daymark-note-dismissed';
const NOTE_MAX = 140;
const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'lilac'] as const;
type NoteColor = (typeof NOTE_COLORS)[number];
type Note = { id: number; text: string; color: NoteColor; expiresAt: number };
const NOTE_EXPIRIES = [
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: '1 day', minutes: 1440 },
  { label: '3 days', minutes: 4320 },
  { label: '1 week', minutes: 10080 },
];
function timeLeft(expiresAt: number, nowMs: number) {
  const mins = Math.max(0, Math.round((expiresAt - nowMs) / 60000));
  if (mins < 60) return `${Math.max(mins, 1)}m left`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h left`;
  return `${Math.round(mins / 1440)}d left`;
}
const THEMES: { id: Theme; label: string }[] = [
  { id: 'forest', label: 'Forest' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'ember', label: 'Ember' },
  { id: 'meadow', label: 'Meadow' },
  { id: 'paper', label: 'Paper' },
  { id: 'eink', label: 'E-ink' },
];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // weeks start on Monday
const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Hyderabad' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'America/Vancouver', label: 'Vancouver' },
  { value: 'America/New_York', label: 'New York' },
  { value: 'America/Los_Angeles', label: 'Los Angeles' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam' },
  { value: 'Europe/Dublin', label: 'Dublin' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

/* ---------- helpers ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s: string) => new Date(`${s}T00:00:00`);
const isTheme = (t: unknown): t is Theme => THEMES.some(x => x.id === t);

function clockParts(date: Date, zone?: string) {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: zone }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return { time: `${get('hour')}:${get('minute')}`, period: get('dayPeriod').toLowerCase() };
}
function fmtTime(date: Date, zone?: string) {
  const { time, period } = clockParts(date, zone);
  return `${time} ${period}`;
}
function fmtShortDate(date: Date, zone?: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zone }).format(date);
}
function to12h(iso?: string) {
  const t = iso?.split('T')[1];
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
}

function weatherInfo(code: number, isDay = true) {
  if (code === 0) return { Icon: isDay ? Sun : Moon, label: 'Clear' };
  if (code === 1) return { Icon: isDay ? Sun : Moon, label: 'Mostly clear' };
  if (code === 2) return { Icon: isDay ? CloudSun : CloudMoon, label: 'Partly cloudy' };
  if (code === 3) return { Icon: Cloud, label: 'Overcast' };
  if (code === 45 || code === 48) return { Icon: CloudFog, label: 'Fog' };
  if (code >= 51 && code <= 57) return { Icon: CloudDrizzle, label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { Icon: CloudRain, label: 'Rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { Icon: CloudSnow, label: 'Snow' };
  if (code >= 80 && code <= 82) return { Icon: CloudRain, label: 'Showers' };
  if (code >= 95) return { Icon: CloudLightning, label: 'Thunderstorm' };
  return { Icon: Cloud, label: 'Cloudy' };
}

/** lucide has no sun hat, so this one matches its stroke style. */
function SunHat({ size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 13c0-4.5 2-8 5-8s5 3.5 5 8" />
      <path d="M2.5 14.5c0-1 4.3-1.8 9.5-1.8s9.5.8 9.5 1.8c0 1.8-4.3 3.5-9.5 3.5s-9.5-1.7-9.5-3.5z" />
      <path d="M7.2 11.2c3 .8 6.6.8 9.6 0" />
    </svg>
  );
}

/** Every calendar day (YYYY-MM-DD) an event touches. */
function spanKeys(e: CalEvent): string[] {
  if (!e.allDay) return [dateKey(new Date(e.start))];
  const keys: string[] = [];
  const end = parseDay(e.end);
  const d = parseDay(e.start);
  for (let i = 0; i < 62 && d < end; i++) {
    keys.push(dateKey(d));
    d.setDate(d.getDate() + 1);
  }
  return keys.length ? keys : [e.start];
}

function dayLabel(key: string, todayKey: string) {
  if (key === todayKey) return 'Today';
  const tomorrow = parseDay(todayKey);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey(tomorrow) === key) return 'Tomorrow';
  return parseDay(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Sample events shown until Google Calendar credentials are configured. */
function demoEvents(base: Date): CalEvent[] {
  const at = (offset: number, h: number, m = 0) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const day = (offset: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return dateKey(d);
  };
  return [
    { id: 'd1', title: "Dinner at Nani's", start: at(0, 19, 30), end: at(0, 21), allDay: false, calendarIndex: 0 },
    { id: 'd2', title: 'Call with Ravi', start: at(0, 21, 30), end: at(0, 22), allDay: false, calendarIndex: 1 },
    { id: 'd3', title: 'Dentist, Amma', start: at(1, 9), end: at(1, 10), allDay: false, calendarIndex: 2 },
    { id: 'd4', title: 'School trip', start: day(3), end: day(4), allDay: true, calendarIndex: 0 },
    { id: 'd5', title: "Cousin's wedding", start: day(6), end: day(7), allDay: true, calendarIndex: 1 },
    { id: 'd6', title: 'Football', start: at(7, 10), end: at(7, 12), allDay: false, calendarIndex: 2 },
  ];
}

/* ---------- component ---------- */
export default function Dashboard() {
  const [now, setNow] = useState<Date | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState<Theme>('forest');
  const [city, setCity] = useState('Hyderabad');
  const [lat, setLat] = useState('17.3850');
  const [lon, setLon] = useState('78.4867');
  const [zone1, setZone1] = useState('America/Toronto');
  const [zone2, setZone2] = useState('America/Vancouver');
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [liveEvents, setLiveEvents] = useState<CalEvent[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [geoQuery, setGeoQuery] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [note, setNote] = useState<Note | null>(null);
  const [dismissedId, setDismissedId] = useState<number | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState<NoteColor>('yellow');
  const [noteMinutes, setNoteMinutes] = useState(1440);
  const [noteKey, setNoteKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // YYYY-MM-DD, null = upcoming list

  /* clock + saved settings */
  useEffect(() => {
    const start = new Date();
    setNow(start);
    setMonth({ year: start.getFullYear(), month: start.getMonth() });
    const timer = window.setInterval(() => {
      setNow(prev => {
        const n = new Date();
        return prev && prev.getMinutes() === n.getMinutes() && prev.getHours() === n.getHours() ? prev : n;
      });
    }, 2000);
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const s = JSON.parse(saved);
        if (isTheme(s.theme)) setTheme(s.theme);
        if (s.city) setCity(s.city);
        if (s.lat) setLat(s.lat);
        if (s.lon) setLon(s.lon);
        if (s.zone1) setZone1(s.zone1);
        if (s.zone2) setZone2(s.zone2);
      }
    } catch { /* ignore malformed saved settings */ }
    setHydrated(true);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, city, lat, lon, zone1, zone2 })); } catch { /* storage unavailable */ }
  }, [hydrated, theme, city, lat, lon, zone1, zone2]);

  /* sticky note: polled every minute and whenever the tab is shown again, so the iPad catches up */
  const fetchNote = useCallback(async () => {
    try {
      const res = await fetch('/api/note', { cache: 'no-store' });
      if (!res.ok) throw new Error('Note unavailable');
      const data = await res.json();
      setNote(data.note ?? null);
    } catch { /* keep showing whatever we already have */ }
  }, []);

  useEffect(() => {
    try {
      const k = localStorage.getItem(NOTE_KEY_STORAGE);
      if (k) { setNoteKey(k); setKeySaved(true); }
      const seen = localStorage.getItem(NOTE_SEEN_STORAGE);
      if (seen) setDismissedId(Number(seen));
    } catch { /* storage unavailable */ }
    fetchNote();
    const timer = window.setInterval(fetchNote, 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchNote(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchNote]);

  /* a tapped day reverts to the upcoming list after 2 minutes, so a wall display never gets stuck on it */
  useEffect(() => {
    if (!selectedDay) return;
    const timer = window.setTimeout(() => setSelectedDay(null), 2 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [selectedDay]);

  /* keep the screen awake. Needs HTTPS (or localhost). The browser drops the lock whenever the
     tab is hidden, so it is re-acquired when the tab becomes visible again. */
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) { l.release().catch(() => {}); return; }
        lock = l;
      } catch { /* denied, e.g. battery saver or insecure context */ }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  /* weather: Open-Meteo, no key needed */
  const fetchWeather = useCallback(async () => {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}` +
        `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
        `&timezone=auto&forecast_days=7`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather unavailable');
      const d = await res.json();
      setWeather({
        current: {
          temp: Math.round(d.current.temperature_2m),
          feels: Math.round(d.current.apparent_temperature),
          humidity: Math.round(d.current.relative_humidity_2m),
          wind: Math.round(d.current.wind_speed_10m),
          code: d.current.weather_code,
          isDay: d.current.is_day === 1,
        },
        days: d.daily.time.map((date: string, i: number) => ({
          date,
          code: d.daily.weather_code[i],
          max: Math.round(d.daily.temperature_2m_max[i]),
          min: Math.round(d.daily.temperature_2m_min[i]),
          rain: d.daily.precipitation_probability_max?.[i] ?? 0,
        })),
        sunrise: d.daily.sunrise[0],
        sunset: d.daily.sunset[0],
      });
      setWeatherError(false);
    } catch {
      setWeatherError(true);
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchWeather();
    const timer = window.setInterval(fetchWeather, 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [fetchWeather]);

  /* calendar: Google Calendar via /api/calendar */
  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar');
      if (!res.ok) throw new Error('Calendar unavailable');
      const data = await res.json();
      if (data.configured) setLiveEvents(data.events as CalEvent[]);
    } catch { /* keep whatever we already have */ }
  }, []);

  useEffect(() => {
    fetchCalendar();
    const timer = window.setInterval(fetchCalendar, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [fetchCalendar]);

  const findCity = async () => {
    const q = geoQuery.trim();
    if (!q) return;
    setGeoBusy(true);
    setGeoError('');
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
      const data = await res.json();
      const hit = data.results?.[0];
      if (!hit) { setGeoError('No place found. Try a nearby city.'); return; }
      setCity(hit.name);
      setLat(String(hit.latitude));
      setLon(String(hit.longitude));
      setGeoQuery('');
    } catch {
      setGeoError('Search failed. Check your connection.');
    } finally {
      setGeoBusy(false);
    }
  };

  const postNote = async () => {
    const text = noteText.trim();
    const key = noteKey.trim();
    if (!text) return;
    if (!key) { setNoteError('Enter the passcode.'); return; }
    setNoteBusy(true);
    setNoteError('');
    try {
      const res = await fetch('/api/note', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-note-key': key },
        body: JSON.stringify({ text, color: noteColor, minutes: noteMinutes }),
      });
      if (res.status === 401) {
        try { localStorage.removeItem(NOTE_KEY_STORAGE); } catch { /* storage unavailable */ }
        setKeySaved(false);
        setNoteError('Wrong passcode.');
        return;
      }
      if (!res.ok) { setNoteError('Could not save the note.'); return; }
      const data = await res.json();
      try { localStorage.setItem(NOTE_KEY_STORAGE, key); } catch { /* storage unavailable */ }
      setKeySaved(true);
      setNote(data.note);
      setNoteText('');
      setShowComposer(false);
    } catch {
      setNoteError('Could not reach the server.');
    } finally {
      setNoteBusy(false);
    }
  };

  /* hides the note on this device right away; with a saved passcode it is also removed everywhere */
  const dismissNote = async () => {
    if (!note) return;
    setDismissedId(note.id);
    try { localStorage.setItem(NOTE_SEEN_STORAGE, String(note.id)); } catch { /* storage unavailable */ }
    if (keySaved) {
      try { await fetch('/api/note', { method: 'DELETE', headers: { 'x-note-key': noteKey } }); } catch { /* offline */ }
    }
  };

  /* derived data */
  const current = now ?? EPOCH;
  const todayKey = dateKey(current);
  const isDemo = liveEvents === null;
  const sourceEvents = useMemo(() => liveEvents ?? demoEvents(current), [liveEvents, current]);

  const eventDays = useMemo(() => {
    const set = new Set<string>();
    sourceEvents.forEach(e => spanKeys(e).forEach(k => set.add(k)));
    return set;
  }, [sourceEvents]);

  const agenda = useMemo(() => {
    const upcoming = sourceEvents.flatMap(e => {
      const keys = spanKeys(e);
      if (e.allDay) {
        const day = keys.find(k => k >= todayKey);
        return day ? [{ e, day }] : [];
      }
      return new Date(e.end || e.start).getTime() >= current.getTime() ? [{ e, day: keys[0] }] : [];
    });
    upcoming.sort((a, b) =>
      a.day.localeCompare(b.day) ||
      (a.e.allDay === b.e.allDay ? 0 : a.e.allDay ? -1 : 1) ||
      new Date(a.e.start).getTime() - new Date(b.e.start).getTime());
    const groups: { day: string; items: CalEvent[] }[] = [];
    for (const { e, day } of upcoming.slice(0, 7)) {
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(e);
      else groups.push({ day, items: [e] });
    }
    return groups;
  }, [sourceEvents, todayKey, current]);

  /* every event touching the selected day, all-day first, then by start time (past ones included) */
  const dayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return sourceEvents
      .filter(e => spanKeys(e).includes(selectedDay))
      .sort((a, b) =>
        (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) ||
        new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [sourceEvents, selectedDay]);
  const shownGroups = selectedDay ? [{ day: selectedDay, items: dayEvents }] : agenda;

  const shownMonth = month ?? { year: current.getFullYear(), month: current.getMonth() };
  const calCells = useMemo(() => {
    const first = (new Date(shownMonth.year, shownMonth.month, 1).getDay() + 6) % 7; // Monday = 0
    const count = new Date(shownMonth.year, shownMonth.month + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)] as (number | null)[];
  }, [shownMonth.year, shownMonth.month]);
  const shiftMonth = (by: number) =>
    setMonth(() => {
      const d = new Date(shownMonth.year, shownMonth.month + by, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  if (!now) return <main className={`dash theme-${theme}`} />;

  const { time, period } = clockParts(now);
  const nowInfo = weather ? weatherInfo(weather.current.code, weather.current.isDay) : null;

  const visibleNote = note && note.id !== dismissedId && note.expiresAt > now.getTime() ? note : null;

  /* umbrella if it is raining or likely to today; hat if it is clear and daytime; otherwise nothing */
  let hint: { kind: 'umbrella' | 'hat'; text: string } | null = null;
  if (weather) {
    const code = weather.current.code;
    const rainToday = weather.days[0]?.rain ?? 0;
    const rainingNow = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
    if (rainingNow) hint = { kind: 'umbrella', text: 'Raining now. Take an umbrella.' };
    else if (rainToday >= RAIN_HINT_PCT) hint = { kind: 'umbrella', text: `${rainToday}% chance of rain. Take an umbrella.` };
    else if (code <= 2 && weather.current.isDay) hint = { kind: 'hat', text: 'Sunny out. Wear a hat.' };
  }
  const zoneName = (z: string) => TIMEZONES.find(t => t.value === z)?.label ?? z.split('/').pop()?.replaceAll('_', ' ') ?? z;

  return (
    <main className={`dash theme-${theme}`}>
      <div className="frame">
        <div className="screen">
          {/* time + weather now */}
          <section className="cell hero">
            <span className="label">Now</span>

            <div className="hero-time">
              <div className="clock">{time}<span className="period">{period}</span></div>
              <div className="date">{new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</div>
            </div>

            <div className="now">
              {weather && nowInfo ? (
                <>
                  <nowInfo.Icon className="now-icon" size={64} strokeWidth={1.5} />
                  <div className="now-temp">{weather.current.temp}°</div>
                  <div className="now-text">
                    <strong>{nowInfo.label}</strong>
                    <span className="where"><MapPin size={16} />{city}</span>
                  </div>
                </>
              ) : (
                <div className="now-text"><strong>{weatherError ? 'Weather unavailable' : 'Loading weather'}</strong>
                  <span className="where"><MapPin size={16} />{city}</span></div>
              )}
            </div>

            {hint && (
              <div className="hint">
                {hint.kind === 'umbrella' ? <Umbrella size={30} strokeWidth={1.6} /> : <SunHat size={30} strokeWidth={1.6} />}
                <span>{hint.text}</span>
              </div>
            )}

            {weather && (
              <div className="stats">
                <div className="stat-line">
                  <span><Droplets size={20} />{weather.current.humidity}% humidity</span>
                  <span><Wind size={20} />{weather.current.wind} km/h</span>
                  <span><Thermometer size={20} />Feels like {weather.current.feels}°</span>
                </div>
                <div className="stat-line sun">
                  <span><Sunrise size={20} />{to12h(weather.sunrise)}</span>
                  <span><Sunset size={20} />{to12h(weather.sunset)}</span>
                </div>
              </div>
            )}
          </section>

          {/* month calendar */}
          <section className="cell cal">
            <div className="cell-head">
              <button type="button" className={`label month-btn ${selectedDay ? 'active' : ''}`} onClick={() => setSelectedDay(null)}
                title={selectedDay ? 'Back to upcoming events' : undefined}>
                {new Date(shownMonth.year, shownMonth.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </button>
              <div className="cal-nav">
                <button onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={20} /></button>
                <button onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={20} /></button>
              </div>
            </div>
            <div className="cal-weekdays">{WEEKDAYS.map((d, i) => <div key={i}>{d}</div>)}</div>
            <div className="cal-days">
              {calCells.map((day, i) => {
                if (!day) return <div key={`blank-${i}`} />;
                const key = `${shownMonth.year}-${pad(shownMonth.month + 1)}-${pad(day)}`;
                return (
                  <button key={key} type="button" aria-pressed={key === selectedDay}
                    aria-label={`${parseDay(key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}${eventDays.has(key) ? ', has events' : ''}`}
                    className={`cal-day ${key === todayKey ? 'today' : ''} ${key === selectedDay ? 'selected' : ''}`}
                    onClick={() => setSelectedDay(s => (s === key ? null : key))}>
                    <span>{day}</span>
                    <b className={eventDays.has(key) ? 'dot on' : 'dot'} />
                  </button>
                );
              })}
            </div>
          </section>

          {/* world clocks */}
          <section className="cell zones-cell">
            <span className="label">World clock</span>
            <div className="zones">
              {[zone1, zone2].map(z => (
                <div className="zone" key={z}>
                  <span>{zoneName(z)}</span>
                  <strong>{fmtTime(now, z)}</strong>
                  <small>{fmtShortDate(now, z)}</small>
                </div>
              ))}
            </div>
          </section>

          {/* upcoming events */}
          <section className="cell agenda">
            <span className="label">{selectedDay ? 'Events' : 'Coming up'}</span>
            <div className="agenda-list">
              {shownGroups.length ? shownGroups.map(group => (
                <div className="group" key={group.day}>
                  <h3>{dayLabel(group.day, todayKey)}</h3>
                  {group.items.length ? group.items.map(e => (
                    <div className="item" key={`${e.id}-${group.day}`}>
                      <span className="time">{e.allDay ? 'All day' : fmtTime(new Date(e.start))}</span>
                      <span className={`mark mark-${e.calendarIndex % 5}`} />
                      <span className="title">{e.title}</span>
                    </div>
                  )) : <p className="empty">Nothing on this day.</p>}
                </div>
              )) : <p className="empty">No upcoming events.</p>}
            </div>
            {isDemo && <p className="agenda-note">Sample events. Add Google Calendar credentials to see yours.</p>}

            {visibleNote && (
              <div className={`note note-${visibleNote.color}`} role="status">
                <button className="note-x" onClick={dismissNote} aria-label="Dismiss note"><X size={16} /></button>
                <p>{visibleNote.text}</p>
                <small>{timeLeft(visibleNote.expiresAt, now.getTime())}</small>
              </div>
            )}

            <button className="add-note" title="New note" aria-label="New sticky note"
              onClick={() => { setNoteError(''); setShowComposer(true); }}><Plus size={18} /></button>
          </section>

          {/* seven-day forecast */}
          <section className="cell week">
            <span className="label">7-day forecast</span>
            {weather ? (
              <div className="week-grid">
                {weather.days.map((day, i) => {
                  const { Icon } = weatherInfo(day.code);
                  return (
                    <div className={`day ${i === 0 ? 'today' : ''}`} key={day.date}>
                      <span className="day-name">{i === 0 ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <Icon size={34} strokeWidth={1.6} />
                      <span className="hi">{day.max}°</span>
                      <span className="lo">{day.min}°</span>
                      <span className="rain"><Droplet size={14} />{day.rain}%</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="empty">{weatherError ? 'Forecast unavailable. Retrying every 30 minutes.' : 'Loading forecast'}</p>}
          </section>

          <button className="gear" aria-label="Open settings" onClick={() => setShowSettings(true)}><Settings2 size={16} /></button>
        </div>
      </div>

      {showComposer && (
        <div className="backdrop center" onClick={() => setShowComposer(false)}>
          <form className="composer" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); postNote(); }}>
            <div className="drawer-head">
              <h2>New note</h2>
              <button type="button" className="close" onClick={() => setShowComposer(false)} aria-label="Close"><X size={18} /></button>
            </div>

            <textarea className={`input note-input note-${noteColor}`} rows={4} maxLength={NOTE_MAX} autoFocus
              value={noteText} placeholder="Pick up milk, call Amma..." aria-label="Note text"
              onChange={e => setNoteText(e.target.value)} />
            <div className="note-count">{noteText.length}/{NOTE_MAX}</div>

            <div className="color-field">
              <span className="field-label">Colour</span>
              <div className="swatch-row" role="radiogroup" aria-label="Note colour">
                {NOTE_COLORS.map(c => (
                  <button type="button" key={c} role="radio" aria-checked={noteColor === c} aria-label={c}
                    className={`color-btn note-${c} ${noteColor === c ? 'on' : ''}`} onClick={() => setNoteColor(c)}>
                    {noteColor === c && <Check size={16} />}
                  </button>
                ))}
              </div>
            </div>

            <span className="field-label">Disappears after</span>
            <div className="chip-row" role="radiogroup" aria-label="Expiry">
              {NOTE_EXPIRIES.map(x => (
                <button type="button" key={x.minutes} role="radio" aria-checked={noteMinutes === x.minutes}
                  className={`chip ${noteMinutes === x.minutes ? 'on' : ''}`} onClick={() => setNoteMinutes(x.minutes)}>
                  {x.label}
                </button>
              ))}
            </div>

            {!keySaved && (
              <>
                <label className="field-label" htmlFor="note-key">Passcode (asked once on this device)</label>
                <input id="note-key" type="password" className="input" value={noteKey}
                  onChange={e => setNoteKey(e.target.value)} autoComplete="current-password" />
              </>
            )}
            {noteError && <p className="field-error">{noteError}</p>}

            <button type="submit" className="btn done" disabled={noteBusy || !noteText.trim()}>{noteBusy ? 'Posting' : 'Post note'}</button>
          </form>
        </div>
      )}

      {showSettings && (
        <div className="backdrop" onClick={() => setShowSettings(false)}>
          <aside className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>Settings</h2>
              <button className="close" onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={18} /></button>
            </div>

            <span className="field-label">Look</span>
            <div className="theme-row">
              {THEMES.map(t => (
                <button key={t.id} className={`theme-btn ${theme === t.id ? 'on' : ''}`} onClick={() => setTheme(t.id)}>
                  <i className={`swatch swatch-${t.id}`} />{t.label}{theme === t.id && <Check size={14} />}
                </button>
              ))}
            </div>

            <label className="field-label" htmlFor="geo">Weather location: {city}</label>
            <div className="search-row">
              <input id="geo" className="input" value={geoQuery} placeholder="Search for a city"
                onChange={e => setGeoQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && findCity()} />
              <button className="btn" onClick={findCity} disabled={geoBusy || !geoQuery.trim()} aria-label="Search city"><Search size={16} /></button>
            </div>
            {geoError && <p className="field-error">{geoError}</p>}

            <label className="field-label" htmlFor="zone1">World clock 1</label>
            <select id="zone1" className="input" value={zone1} onChange={e => setZone1(e.target.value)}>
              {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <label className="field-label" htmlFor="zone2">World clock 2</label>
            <select id="zone2" className="input" value={zone2} onChange={e => setZone2(e.target.value)}>
              {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <button className="btn done" onClick={() => setShowSettings(false)}>Done</button>
          </aside>
        </div>
      )}
    </main>
  );
}