import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Best Dressed | MAC",
  description: "Nominate and vote for best dressed on the night.",
};

export const viewport: Viewport = {
  themeColor: "#252525",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
