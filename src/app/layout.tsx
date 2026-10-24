import type { Metadata } from "next";
import { Providers } from "@/components/context";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Lamariva | CV & Cover Letter", template: "%s | Lamariva" },
  description: "Buat CV, surat lamaran, dan kelola proses melamar kerja.",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3035"),
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
