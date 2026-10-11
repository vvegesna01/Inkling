# Daymark

A home dashboard for a wall or shelf display, built with Next.js and TypeScript. One framed screen shows the time, current weather, a month calendar, upcoming events and a seven-day forecast. It has two looks: Forest (deep green in an oak frame) and Paper (grey e-ink).

## Included

- Live local clock and date
- Two world clocks
- Current weather, humidity, wind, sunrise and sunset, plus a seven-day forecast from Open-Meteo (no API key)
- City search for the weather location
- Month calendar (weeks start on Monday) with event dots
- Password-protected site
- Upcoming events from Google Calendar (read-only, one or more calendars)
- Forest and Paper themes
- Settings saved in the browser

## Run locally

```bash
npm install
npm install googleapis
npm run dev
```

Open http://localhost:3000. Without Google credentials the dashboard shows sample events.

Before publishing:

```bash
npm run typecheck
npm run build
```

## Connect Google Calendar

Daymark reads your calendars through a Google service account, so there is no login screen on the display.

1. In the [Google Cloud Console](https://console.cloud.google.com), create a project and enable the **Google Calendar API**.
2. Go to **IAM & Admin → Service Accounts**, create a service account, then open it and add a key (**Keys → Add key → JSON**). Download the file.
3. In Google Calendar, open each calendar's **Settings and sharing**, choose **Share with specific people**, and add the service account's email (`client_email` in the JSON). Give it **See all event details**.
4. On the same settings page, copy the **Calendar ID**. For your main calendar this is your Gmail address.
5. Copy `.env.example` to `.env.local` and fill in:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: the `client_email` value
   - `GOOGLE_PRIVATE_KEY`: the `private_key` value, in quotes, with the `\n` characters kept
   - `GOOGLE_CALENDAR_IDS`: one or more calendar IDs separated by commas
6. Restart `npm run dev`. The sample-events note disappears once real events load.

On Vercel, add the same three variables under **Project → Settings → Environment Variables** and redeploy.

The browser never sees your credentials. It calls `/api/calendar`, which runs on the server, looks 60 days ahead, and is cached for five minutes. The dashboard refreshes it every ten minutes.

## Password

The whole site, including the calendar endpoint, sits behind a password. Set `DASHBOARD_PASSWORD` in `.env.local` and in Vercel. Visitors see a sign-in page, and a correct password keeps that device signed in for a year. If the variable is missing on a deployed site, the site refuses to load instead of showing your calendar.

To change the password, update the variable, redeploy, and sign in again on each device.

If Next.js 16 warns that `middleware.ts` is deprecated, rename the file to `proxy.ts` and rename the exported function to `proxy`.

## Weather

Open **Settings** (the gear in the bottom-right corner), type a city and press search. Coordinates are filled in for you. The forecast refreshes every 30 minutes. If the weather service cannot be reached, the dashboard says so instead of showing made-up numbers.

## iPad setup

1. Open the deployed site in Safari on your iPad.
2. Tap **Share → Add to Home Screen**.
3. In Settings, set **Display & Brightness → Auto-Lock** to a longer duration.
4. In Shortcuts, create a personal automation for **Charger → Is Connected** that opens Daymark.

A website cannot force iPadOS to keep the screen awake. Auto-Lock and Guided Access decide that.

## Files

- `app/page.tsx`: the dashboard
- `app/globals.css`: themes, frame and layout
- `app/api/calendar/route.ts`: Google Calendar endpoint
- `middleware.ts`, `app/login/page.tsx`, `app/api/login/route.ts`: password protection
- `.env.example`: environment variables