import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/_lib/auth-context";
import { InventoryProvider } from "@/_lib/inventory-context";
import { LenisProvider } from "./components/LenisProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "StockShiftAI - Inventory Management",
  description: "Streamline your inventory. Master your finances.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`font-sans ${inter.variable} antialiased bg-background text-foreground`}>
        <LenisProvider>
          <AuthProvider>
            <InventoryProvider>{children}</InventoryProvider>
          </AuthProvider>
        </LenisProvider>
      </body>
    </html>
  );
}
