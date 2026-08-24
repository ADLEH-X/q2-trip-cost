import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YolPay™ | Akıllı Yolculuk Maliyeti & Yakıt Hesabı",
  description: "Trafiğe duyarlı gerçek yakıt tüketimi, canlı akaryakıt fiyatları ve köprü/otoyol geçiş ücreti hesaplayıcı.",
  manifest: "/manifest.json",
  icons: {
    icon: "/yolpay-logo.jpg",
    apple: "/yolpay-logo.jpg",
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
        <meta name="theme-color" content="#0a0a0a" />
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
