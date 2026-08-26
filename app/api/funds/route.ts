/**
 * GET /api/funds?date=YYYY-MM
 * TEFAS'tan aktif YAT fon listesini döner.
 * Yanıt: { funds: TefasFund[], fetchedAt: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchTefasFunds, ymToIso } from "@/lib/tefas";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const now = new Date();
  // Varsayılan: geçen ay (PDR 1 ay gecikmeli)
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;
  const ym = searchParams.get("date") || defaultYM;

  try {
    const fetchedAt = new Date().toISOString();
    const funds = await fetchTefasFunds(ymToIso(ym));

    if (!funds.length) {
      return NextResponse.json(
        { error: "TEFAS'tan fon verisi alınamadı. API geçici olarak yanıt vermeyebilir." },
        { status: 502 }
      );
    }

    return NextResponse.json({ funds, fetchedAt });
  } catch (err) {
    console.error("[/api/funds]", err);
    return NextResponse.json(
      { error: "TEFAS bağlantı hatası: " + String(err) },
      { status: 502 }
    );
  }
}
