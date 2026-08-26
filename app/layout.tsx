import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FonAnaliz — BIST HSYF Ağ İstihbaratı",
  description:
    "Hisse Senedi Yoğun Fonların (HSYF) aylık Portföy Dağılım Raporlarını analiz eden, " +
    "fonlar ile hisseler arasındaki bağlantıları interaktif ağ grafiği ile görselleştiren ve " +
    "gelişmiş hisse seçim radarı sunan BIST analiz platformu.",
  keywords: ["BIST", "HSYF", "fon analiz", "portföy dağılım raporu", "TEFAS", "hisse senedi"],
  authors: [{ name: "FonAnaliz" }],
  openGraph: {
    title: "FonAnaliz — BIST HSYF Ağ İstihbaratı",
    description: "HSYF portföy dağılım radarı ve interaktif knowledge graph.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="overflow-hidden">{children}</body>
    </html>
  );
}
