import type { Metadata } from "next";
import { CartProvider } from "@/components/cart/CartProvider";
import { WishlistProvider } from "@/store/wishlistStore";
import { LocationProvider } from "@/store/locationStore";
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
        <LocationProvider>
          <WishlistProvider>
            <CartProvider>{children}</CartProvider>
          </WishlistProvider>
        </LocationProvider>
      </body>
    </html>
  );
}
