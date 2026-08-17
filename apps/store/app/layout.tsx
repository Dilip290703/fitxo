import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitXo Store",
  description: "FitXo store manager panel.",
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
