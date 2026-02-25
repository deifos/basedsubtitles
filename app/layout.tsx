import type { Metadata } from "next";
import Script from "next/script";
import {
  Geist,
  Geist_Mono,
  Montserrat,
  Bebas_Neue,
  Poppins,
  Oswald,
  Anton,
  Bangers,
  Fredoka,
  Righteous,
  Nunito,
  Roboto,
  Open_Sans,
  Inter,
  Permanent_Marker,
  Pacifico,
  Lobster,
  Alfa_Slab_One,
  Staatliches,
  Fugaz_One,
  Chewy,
  Playfair_Display,
  Lora,
  Plus_Jakarta_Sans,
  Outfit,
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
  weight: ["400", "600", "700", "900"],
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

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const bangers = Bangers({
  variable: "--font-bangers",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const righteous = Righteous({
  variable: "--font-righteous",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
});

const permanentMarker = Permanent_Marker({
  variable: "--font-permanent-marker",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const pacifico = Pacifico({
  variable: "--font-pacifico",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const lobster = Lobster({
  variable: "--font-lobster",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const alfaSlabOne = Alfa_Slab_One({
  variable: "--font-alfa-slab-one",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const staatliches = Staatliches({
  variable: "--font-staatliches",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const fugazOne = Fugaz_One({
  variable: "--font-fugaz-one",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const chewy = Chewy({
  variable: "--font-chewy",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${bebasNeue.variable} ${poppins.variable} ${oswald.variable} ${anton.variable} ${bangers.variable} ${fredoka.variable} ${righteous.variable} ${nunito.variable} ${roboto.variable} ${openSans.variable} ${inter.variable} ${permanentMarker.variable} ${pacifico.variable} ${lobster.variable} ${alfaSlabOne.variable} ${staatliches.variable} ${fugazOne.variable} ${chewy.variable} ${playfairDisplay.variable} ${lora.variable} ${plusJakartaSans.variable} ${outfit.variable} antialiased`}
      >
        {children}
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="0a0b9573-0bbf-4229-a918-3a5224cb2d1b"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
