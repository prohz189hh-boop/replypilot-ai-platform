import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ReplyPilot — A little less busy. A lot more business.",
  description:
    "A multilingual workspace for customer conversations, your catalog, and everyday business.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
