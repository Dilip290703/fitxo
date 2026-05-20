import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/CartProvider";
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
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
