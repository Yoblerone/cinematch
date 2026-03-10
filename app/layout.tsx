import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans } from 'next/font/google';
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
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <body className="font-sans antialiased bg-cherry-950 text-[#f5e6e8] min-h-[100dvh] flex flex-col overflow-x-hidden">
        <div className="flex-1 min-h-[100dvh] border-2 border-double border-brass/80 overflow-x-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
