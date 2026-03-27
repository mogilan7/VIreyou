import type { Metadata } from "next";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export const metadata: Metadata = {
  title: "VI antiage - Longevity Portal",
  description: "Science-backed holistic wellness and longevity specialist.",
  openGraph: {
    title: "VI antiage - Longevity Portal",
    description: "Science-backed holistic wellness and longevity specialist. Discover your biological age and optimize your vitality.",
    url: "https://vireyou.com",
    siteName: "VI antiage",
    images: [
      {
        url: "https://vireyou.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "VI antiage - Longevity Portal",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VI antiage - Longevity Portal",
    description: "Science-backed holistic wellness and longevity specialist.",
    images: ["https://vireyou.com/og-image.png"],
  },
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          <main className="min-h-screen w-full">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
