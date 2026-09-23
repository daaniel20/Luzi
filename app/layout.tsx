import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: "LUZI · הלוח היומי",
  description: "בונים לוח זמנים יומי לילדים בגרירה ושחרור, ברבעי שעה.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e7f2fa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${rubik.variable} ${rubik.className} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
