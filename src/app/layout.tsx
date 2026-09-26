import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nakconel Examinations",
  description: "Nakconel student examination portal",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
