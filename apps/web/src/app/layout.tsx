import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gigify",
  description: "AI-powered booking agent for independent musicians",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
