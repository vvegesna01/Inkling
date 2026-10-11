import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daymark — Your day, at a glance',
  description: 'A calm, paper-inspired home dashboard for time, weather, calendar events, and little notes.',
  applicationName: 'Daymark',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Daymark' },
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#efeee8' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
