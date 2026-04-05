import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'pmu.sg',
  description: 'Augmenting Human Potential',
  openGraph: {
    title: 'pmu.sg',
    description: 'Augmenting Human Potential',
    url: 'https://pmu.sg',
    siteName: 'pmu.sg',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'pmu.sg',
    description: 'Augmenting Human Potential',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
