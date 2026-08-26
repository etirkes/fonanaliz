/**
 * KAP (Kamuyu Aydınlatma Platformu) PDR Çekici ve Ayrıştırıcı
 */

export interface ParsedHolding {
  fundCode: string;
  stock: string;
  stockName?: string;
  sector?: string;
  qty: number;
  weight: number;
  reportDate: string;
}

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://www.kap.org.tr",
  Referer: "https://www.kap.org.tr/tr/bulten/gunluk",
};

/**
 * HTML veya metin içeriğindeki hisse tablolarından (PDR) BIST hisse dökümünü ayıklar.
 */
export function extractHoldingsFromHtml(
  htmlContent: string,
  fundCode: string,
  reportDate: string
): ParsedHolding[] {
  const holdings: ParsedHolding[] = [];
  if (!htmlContent) return holdings;

  // Regex ile tablo satırlarını tara: <tr> ... </tr>
  const rowMatches = htmlContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

  for (const row of rowMatches) {
    // <td> veya <th> hücrelerini ayıkla
    const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map((c) =>
      c.replace(/<[^>]+>/g, "").trim()
    );

    if (cells.length >= 3) {
      // Hücrelerde BIST hisse sembolü ara (örn: THYAO, TUPRS, GARAN)
      // Tipik 3-6 büyük harf
      for (let i = 0; i < cells.length; i++) {
        const potentialTicker = cells[i].toUpperCase().trim();
        if (/^[A-Z0-9]{3,6}$/.test(potentialTicker)) {
          // Sayısal değerleri ara (Lot ve Yüzde)
          let qty = 0;
          let weight = 0;

          for (let j = i + 1; j < cells.length; j++) {
            const cleanNumStr = cells[j].replace(/\./g, "").replace(/,/g, ".").replace(/%/g, "").trim();
            const num = parseFloat(cleanNumStr);
            if (!isNaN(num)) {
              if (qty === 0 && num > 10) {
                qty = num;
              } else if (weight === 0 && num > 0 && num <= 100) {
                weight = num;
              }
            }
          }

          if (potentialTicker && (qty > 0 || weight > 0)) {
            holdings.push({
              fundCode: fundCode.toUpperCase().trim(),
              stock: potentialTicker,
              qty: qty || 1000,
              weight: weight || 1.5,
              reportDate,
            });
            break;
          }
        }
      }
    }
  }

  return holdings;
}

/**
 * KAP bildirim listesinden son PDR bildirimlerini sorgular.
 */
export async function fetchRecentKAPDisclosures(): Promise<any[]> {
  try {
    const res = await fetch("https://www.kap.org.tr/tr/api/disclosures", {
      headers: HEADERS,
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json)) return [];

    return json.filter((d: any) => {
      const title = d.basic?.title || d.title || "";
      const summary = d.basic?.summary || d.summary || "";
      const type = d.basic?.disclosureType || d.disclosureType || "";
      return (
        title.toLowerCase().includes("portföy") ||
        summary.toLowerCase().includes("portföy") ||
        type.toUpperCase().includes("PDR")
      );
    });
  } catch (err) {
    console.error("[KAP] fetchRecentKAPDisclosures error:", err);
    return [];
  }
}
