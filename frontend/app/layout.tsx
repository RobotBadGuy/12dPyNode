import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PyChain - 12d Model Chain Generator',
  description:
    'Generate 12d Model chain files from DWG/DGN/IFC files with Excel naming conventions',
  keywords: [
    '12d Model',
    'Chain Files',
    'DWG',
    'DGN',
    'IFC',
    'CAD',
    'Survey',
    'Civil Engineering',
  ],
  authors: [{ name: 'PyChain Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#667eea',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en' className={`${inter.variable} ${poppins.variable}`}>
      <head>
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin='anonymous'
        />
      </head>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}



