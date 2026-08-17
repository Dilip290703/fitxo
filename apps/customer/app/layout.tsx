import type { Metadata } from "next";
import { Jost, Playfair_Display } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import { WishlistProvider } from "@/store/wishlistStore";
import { LocationProvider } from "@/store/locationStore";
import "./globals.css";

const displayFont = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const sansFont = Jost({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FitXo",
  description: "Fashion delivery with try-before-you-buy convenience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${sansFont.variable}`}>
      <body>
        <LocationProvider>
          <WishlistProvider>
            <CartProvider>{children}</CartProvider>
          </WishlistProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
