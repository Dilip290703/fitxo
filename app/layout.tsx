import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitZo",
  description: "Fashion delivery with try-before-you-buy convenience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
