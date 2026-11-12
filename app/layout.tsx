import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Recruitment HMI Cabang Pringsewu — Mulai Langkahmu",
  description: "Kenali HMI, temukan teman baru, dan mulai langkahmu. Pendaftaran Open Recruitment HMI Cabang Pringsewu.",
  icons: {
    icon: "/images/hmi-pringsewu.png",
    shortcut: "/images/hmi-pringsewu.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
