import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repobox",
  description: "Self-hosted AI Code Agent Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
