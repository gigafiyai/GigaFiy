import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gigify",
  description: "AI-powered booking agent for independent musicians",
};

// Apply the saved theme before paint to avoid a flash. Dark is the default;
// only light-preference users get the `.light` class added.
const themeScript = `(function(){try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.add('light')}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
