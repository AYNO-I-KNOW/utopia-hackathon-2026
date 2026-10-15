import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Crybaby",
  description: "Mobile baby care wireframe",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
