import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Cinematch — Premium Movie Discovery',
  description: 'Find your perfect film with the Red Carpet Wizard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full overflow-hidden ${playfair.variable} ${dmSans.variable}`}>
      <body className="font-sans antialiased bg-cherry-950 text-[#f5e6e8] flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 h-full w-full flex-1 flex-col overflow-hidden border-2 border-double border-brass/80">
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
