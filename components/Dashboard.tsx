'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudRain, CloudDrizzle, CloudSnow, CloudFog, CloudLightning,
  ChevronLeft, ChevronRight, MapPin, Settings2, X, Check, Droplets, Droplet, Wind, Sunrise, Sunset, Search,
} from 'lucide-react';

/* ---------- types ---------- */
type Theme = 'forest' | 'paper';
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
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Hyderabad' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'America/Vancouver', label: 'Vancouver' },
  { value: 'America/New_York', label: 'New York' },
  { value: 'America/Los_Angeles', label: 'Los Angeles' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

/* ---------- helpers ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s: string) => new Date(`${s}T00:00:00`);

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
        if (s.theme === 'forest' || s.theme === 'paper') setTheme(s.theme);
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

  const shownMonth = month ?? { year: current.getFullYear(), month: current.getMonth() };
  const calCells = useMemo(() => {
    const first = new Date(shownMonth.year, shownMonth.month, 1).getDay();
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
  const zoneName = (z: string) => TIMEZONES.find(t => t.value === z)?.label ?? z.split('/').pop()?.replaceAll('_', ' ') ?? z;

  return (
    <main className={`dash theme-${theme}`}>
      <div className="frame">
        <div className="screen">
          {/* time + weather now + world clocks */}
          <section className="cell hero">
            <div>
              <div className="clock">{time}<span className="period">{period}</span></div>
              <div className="date">{new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}</div>
            </div>

            <div className="now">
              {weather && nowInfo ? (
                <>
                  <nowInfo.Icon className="now-icon" size={58} strokeWidth={1.5} />
                  <div className="now-temp">{weather.current.temp}°</div>
                  <div className="now-text">
                    <strong>{nowInfo.label}</strong>
                    <span className="where"><MapPin size={13} />{city}</span>
                  </div>
                </>
              ) : (
                <div className="now-text"><strong>{weatherError ? 'Weather unavailable' : 'Loading weather'}</strong>
                  <span className="where"><MapPin size={13} />{city}</span></div>
              )}
            </div>

            {weather && (
              <div className="stats">
                <span><Droplets size={15} />{weather.current.humidity}% humidity</span>
                <span><Wind size={15} />{weather.current.wind} km/h</span>
                <span>Feels like {weather.current.feels}°</span>
                <span><Sunrise size={15} />{to12h(weather.sunrise)}</span>
                <span><Sunset size={15} />{to12h(weather.sunset)}</span>
              </div>
            )}

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

          {/* month calendar */}
          <section className="cell cal">
            <div className="cell-head">
              <h2 className="cell-title">{new Date(shownMonth.year, shownMonth.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
              <div className="cal-nav">
                <button onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
                <button onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={18} /></button>
              </div>
            </div>
            <div className="cal-weekdays">{WEEKDAYS.map((d, i) => <div key={i}>{d}</div>)}</div>
            <div className="cal-days">
              {calCells.map((day, i) => {
                if (!day) return <div key={`blank-${i}`} />;
                const key = `${shownMonth.year}-${pad(shownMonth.month + 1)}-${pad(day)}`;
                return (
                  <div key={key} className={`cal-day ${key === todayKey ? 'today' : ''}`}>
                    <span>{day}</span>
                    <b className={eventDays.has(key) ? 'dot on' : 'dot'} />
                  </div>
                );
              })}
            </div>
          </section>

          {/* upcoming events */}
          <section className="cell agenda">
            <h2 className="cell-title">Coming up</h2>
            <div className="agenda-list">
              {agenda.length ? agenda.map(group => (
                <div className="group" key={group.day}>
                  <h3>{dayLabel(group.day, todayKey)}</h3>
                  {group.items.map(e => (
                    <div className="item" key={`${e.id}-${group.day}`}>
                      <span className="time">{e.allDay ? 'All day' : fmtTime(new Date(e.start))}</span>
                      <span className={`mark mark-${e.calendarIndex % 3}`} />
                      <span className="title">{e.title}</span>
                    </div>
                  ))}
                </div>
              )) : <p className="empty">No upcoming events.</p>}
            </div>
            {isDemo && <p className="agenda-note">These are sample events. Add your Google Calendar credentials to see yours.</p>}
          </section>

          {/* seven-day forecast */}
          <section className="cell week">
            {weather ? (
              <div className="week-grid">
                {weather.days.map((day, i) => {
                  const { Icon } = weatherInfo(day.code);
                  return (
                    <div className={`day ${i === 0 ? 'today' : ''}`} key={day.date}>
                      <span className="day-name">{i === 0 ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <Icon size={28} strokeWidth={1.6} />
                      <span className="hi">{day.max}°</span>
                      <span className="lo">{day.min}°</span>
                      <span className="rain"><Droplet size={11} />{day.rain}%</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="empty">{weatherError ? 'Forecast unavailable. Retrying every 30 minutes.' : 'Loading forecast'}</p>}
          </section>

          <button className="gear" aria-label="Open settings" onClick={() => setShowSettings(true)}><Settings2 size={18} /></button>
        </div>
      </div>

      {showSettings && (
        <div className="backdrop" onClick={() => setShowSettings(false)}>
          <aside className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>Settings</h2>
              <button className="close" onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={18} /></button>
            </div>

            <span className="field-label">Look</span>
            <div className="theme-row">
              <button className={`theme-btn ${theme === 'forest' ? 'on' : ''}`} onClick={() => setTheme('forest')}>
                <i className="swatch swatch-forest" />Forest{theme === 'forest' && <Check size={14} />}
              </button>
              <button className={`theme-btn ${theme === 'paper' ? 'on' : ''}`} onClick={() => setTheme('paper')}>
                <i className="swatch swatch-paper" />Paper{theme === 'paper' && <Check size={14} />}
              </button>
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