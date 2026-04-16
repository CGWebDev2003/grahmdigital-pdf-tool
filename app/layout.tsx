import type { Metadata } from "next";
import Header from "@/components/header/Header";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brief Tool | Grahm Digital",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <Header />  
        {children}
      </body>
    </html>
  );
}
