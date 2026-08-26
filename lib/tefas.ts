/**
 * TEFAS API İstemcisi — Yeni API (2026)
 *
 * INFO:  https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir
 * DIST:  https://www.tefas.gov.tr/api/funds/dagilimSiraliGetirT
 */

export interface TefasFund {
  code: string;
  name: string;
  manager: string;
  aum: number;
  monthlyReturn: number;
  kind: string;
}

export interface TefasHolding {
  fundCode: string;
  stock: string;
  stockName: string;
  sector: string;
  qty: number;
  weight: number;
  reportDate: string;
}

const BASE = "https://www.tefas.gov.tr";
const INFO_URL = `${BASE}/api/funds/fonGnlBlgSiraliGetir`;
const DIST_URL = `${BASE}/api/funds/dagilimSiraliGetirT`;

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  Origin: BASE,
  Referer: `${BASE}/tr/fon-verileri`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
};

// "YYYY-MM-DD" -> "YYYYMMDD"
function toTefasDateStr(iso: string): string {
  return iso.replace(/-/g, "");
}

// "YYYY-MM" -> ayın son gününün ISO tarihi "YYYY-MM-DD"
export function ymToIso(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function getBasePayload(dateStr: string) {
  return {
    fonTipi: "YAT",
    fonKodu: null,
    aramaMetni: null,
    fonTurKod: null,
    fonGrubu: null,
    sfonTurKod: null,
    fonTurAciklama: null,
    kurucuKod: null,
    basTarih: dateStr,
    bitTarih: dateStr,
    basSira: 1,
    bitSira: 100000,
    dil: "TR",
    sFonTurKod: "",
    fonKod: "",
    fonGrup: "",
    fonUnvanTip: "",
  };
}

export function isHSYF(f: { name: string; kind?: string }): boolean {
  const text = `${f.name} ${f.kind || ""}`.toLocaleUpperCase("tr-TR");
  const isHisse =
    text.includes("HİSSE SENEDİ") ||
    text.includes("HISSE SENEDI") ||
    text.includes("HİSSE YOĞUN") ||
    text.includes("HSYF") ||
    text.includes("HİSSE");
  const isExcluded =
    text.includes("PARA PİYASASI") ||
    text.includes("BORÇLANMA") ||
    text.includes("KİRA SERTİFİKASI") ||
    text.includes("KIRA SERTIFIKASI") ||
    text.includes("KIYMETLİ MADEN") ||
    text.includes("ALTIN") ||
    text.includes("GÜMÜŞ") ||
    text.includes("LİKİT") ||
    text.includes("TAHVİL") ||
    text.includes("BONO");
  return isHisse && !isExcluded;
}

export async function fetchTefasFunds(dateIso: string): Promise<TefasFund[]> {
  const dateStr = toTefasDateStr(dateIso);
  const body = getBasePayload(dateStr);

  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`TEFAS fonGnlBlg hatası: HTTP ${res.status}`);
  const json = await res.json();
  const rows: Record<string, unknown>[] = json?.resultList ?? json?.veriler ?? [];
  if (rows.length > 0) { console.log("TEFAS_FUNDS_FIRST_ROW:", rows[0]); }

  return rows
    .map((r) => ({
      code: String(r["fonKodu"] ?? ""),
      name: String(r["fonUnvan"] ?? r["fonUnvani"] ?? ""),
      manager: String(r["kurucuUnvan"] ?? ""),
      aum: Number(r["portfoyBuyukluk"] ?? 0),
      monthlyReturn: Number(r["getiri1Ay"] ?? 0),
      kind: String(r["fonTurAciklama"] ?? "YAT"),
    }))
    .filter((f) => f.code && isHSYF(f));
}

export async function fetchTefasDist(dateIso: string): Promise<TefasHolding[]> {
  const dateStr = toTefasDateStr(dateIso);
  const body = getBasePayload(dateStr);

  const res = await fetch(DIST_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`TEFAS dagilim hatası: HTTP ${res.status}`);
  const json = await res.json();
  const rows: Record<string, unknown>[] = json?.resultList ?? json?.veriler ?? [];

  return rows
    .map((r) => ({
      fundCode: String(r["fonKodu"] ?? ""),
      stock: String(r["enstrumanKodu"] ?? r["enstruman"] ?? r["ihracciKurumKodu"] ?? ""),
      stockName: String(r["enstrumanAciklama"] ?? r["ihracciKurumUnvan"] ?? ""),
      sector: String(r["sektorAdi"] ?? "Diğer"),
      qty: Number(r["adet"] ?? r["lot"] ?? 0),
      weight: Number(r["oran"] ?? r["portfoyYuzdesi"] ?? 0),
      reportDate: dateIso,
    }))
    .filter((h) => h.fundCode && h.stock && h.qty > 0);
}
