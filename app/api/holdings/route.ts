/**
 * GET /api/holdings?date=YYYY-MM&prevDate=YYYY-MM
 *
 * İki PDR dönemini karşılaştıran holding verisi döner.
 * Yanıt: { holdings, stocks, funds, reportDate, prevReportDate, fetchedAt }
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchTefasDist, fetchTefasFunds, ymToIso } from "@/lib/tefas";
import { normalizeHoldings } from "@/lib/normalize";

export const runtime = "nodejs";

/** "YYYY-MM" → bir önceki ay "YYYY-MM" */
function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" → "Ocak 2025" */
function toTurkishMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const months = [
    "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
    "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
  ];
  return `${months[m - 1]} ${y}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  const date = searchParams.get("date") || defaultDate;
  const prev = searchParams.get("prevDate") || prevMonth(date);

  const isoDate     = ymToIso(date);
  const isoPrevDate = ymToIso(prev);

  try {
    const fetchedAt = new Date().toISOString();

    // Paralel çek: t dönemi dağılım + t-1 dönemi dağılım + fon bilgisi
    const [currentDist, prevDist, funds] = await Promise.all([
      fetchTefasDist(isoDate),
      fetchTefasDist(isoPrevDate),
      fetchTefasFunds(isoDate),
    ]);

    const normalized = normalizeHoldings(
      currentDist,
      prevDist,
      toTurkishMonth(date),
      toTurkishMonth(prev),
      fetchedAt
    );

    // Fon listesini normalizeHoldings'ten gelen stock meta ile birleştir
    return NextResponse.json({
      ...normalized,
      funds: funds.length ? funds : normalized.funds,
      fetchedAt,
    });
  } catch (err) {
    console.error("[/api/holdings]", err);
    return NextResponse.json(
      { error: "TEFAS veri çekme hatası: " + String(err) },
      { status: 502 }
    );
  }
}
