import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { YOLPAY_LOGO_BASE64 } from "@/assets/logo";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://yolpay.vercel.app"),
  title: "YolPay™ | Akıllı Yolculuk Maliyeti & Yakıt Hesabı",
  description: "Trafiğe duyarlı gerçek yakıt tüketimi, canlı akaryakıt fiyatları ve köprü/otoyol geçiş ücreti hesaplayıcı.",
  applicationName: "YolPay™",
  keywords: [
    "YolPay",
    "İstanbul yol ücreti",
    "Avrasya Tüneli ücreti",
    "köprü geçiş ücreti hesaplama",
    "yakıt tüketimi hesaplama",
    "HGS hesaplama",
    "Istanbul toll calculator",
    "trip cost calculator",
  ],
  verification: {
    google: "U2oTqRQ48plcFIIkxYV67r1qlx3tnqUpYiGa_wj0J8U",
  },
  openGraph: {
    title: "YolPay™ | Akıllı Yolculuk Maliyeti & Yakıt Hesabı",
    description: "Trafiğe duyarlı gerçek yakıt tüketimi, canlı akaryakıt fiyatları ve köprü/otoyol geçiş ücreti hesaplayıcı.",
    url: "https://yolpay.vercel.app",
    siteName: "YolPay™",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "YolPay™ | Akıllı Yolculuk Maliyeti",
    description: "Trafiğe duyarlı gerçek yakıt tüketimi, canlı akaryakıt fiyatları ve köprü/otoyol geçiş ücreti hesaplayıcı.",
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: "YolPay™",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: YOLPAY_LOGO_BASE64 },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: YOLPAY_LOGO_BASE64 },
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var saved = localStorage.getItem('q2_theme');
                if (saved === 'light') {
                  document.documentElement.setAttribute('data-theme', 'light');
                } else {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              } catch(e) {}
            })()`,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
