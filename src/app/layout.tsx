import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "professor.ai",
  description: "Plataforma de ensino para professores universitários",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
