import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'pmu.sg',
  description: 'Hardened AI Orchestration for Regulated Environments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
