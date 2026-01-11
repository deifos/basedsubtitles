import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Montserrat,
  Bebas_Neue,
  Poppins,
  Oswald,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Based Subtitles - AI Video Subtitle Generator",
    template: "%s | Based Subtitles"
  },
  description: "Generate professional subtitles for your videos with AI. 100% local, privacy-first subtitle generation powered by transformers.js. No server uploads required.",
  keywords: ["subtitles", "video subtitles", "AI subtitles", "subtitle generator", "video captions", "transcription", "local AI", "privacy-first", "transformers.js", "whisper"],
  authors: [{ name: "deifosv", url: "https://x.com/deifosv" }],
  creator: "deifosv",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://basedsubs.getbasedapps.com",
    title: "Based Subtitles - AI Video Subtitle Generator",
    description: "Generate professional subtitles for your videos with AI. 100% local, privacy-first subtitle generation.",
    siteName: "Based Subtitles",
  },
  twitter: {
    card: "summary_large_image",
    title: "Based Subtitles - AI Video Subtitle Generator",
    description: "Generate professional subtitles for your videos with AI. 100% local, privacy-first subtitle generation.",
    creator: "@deifosv",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${bebasNeue.variable} ${poppins.variable} ${oswald.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
