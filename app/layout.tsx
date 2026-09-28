import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rubik",
});

const description =
  "לוח זמנים יומי לילדים. גוררים משימה לשעה, מסמנים כשנגמר, ורואים את כל היום במבט אחד."

export const metadata: Metadata = {
  metadataBase: new URL("https://luzi-mocha.vercel.app"),
  title: "LUZI · הלוח היומי",
  description,
  applicationName: "LUZI",
  openGraph: {
    title: "LUZI · הלוח היומי",
    description,
    url: "https://luzi-mocha.vercel.app",
    siteName: "LUZI",
    locale: "he_IL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LUZI · הלוח היומי",
    description,
  },
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
