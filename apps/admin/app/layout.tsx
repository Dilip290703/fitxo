import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitZo Admin",
  description: "FitZo administration panel.",
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
