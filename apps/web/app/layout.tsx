import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DegenRadar | Solana Intelligence & Culture Radar",
  description: "Event-driven Solana token intelligence and internet meme lifecycle platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-gray-100 min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
