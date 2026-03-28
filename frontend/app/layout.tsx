import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MuiProvider from "./components/MuiProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ATL Connect",
  description: "Your AI guide to Atlanta community resources",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Leaflet CSS — must be in <head> for map to render correctly */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
      </head>
      <body className={inter.className}>
        <MuiProvider>{children}</MuiProvider>
      </body>
    </html>
  );
}
