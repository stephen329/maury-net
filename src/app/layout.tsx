import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maury.net | Three Generations of Nantucket Real Estate",
  description: "Beyond real estate, my work is shaped by three generations of island life—dedicated to preserving Nantucket's character while helping clients make confident, informed decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
