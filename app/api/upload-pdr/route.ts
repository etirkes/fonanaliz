import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "buffer" });
    
    // Varsayım: İlk sayfada PDR verisi var
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Excel'den JSON'a dönüştür (Başlık satırını 1. satır kabul eder)
    const data = xlsx.utils.sheet_to_json<any>(sheet);

    // TODO: Cloudflare D1 veritabanı ekleme mantığı
    // const env = process.env as unknown as { DB: D1Database }; // getRequestContext() ile de alınabilir
    // const { env } = getRequestContext();
    // await env.DB.prepare("INSERT INTO fund_holdings ...").run();

    // Şimdilik sadece başarılı yanıt dönelim (Gerçek DB entegrasyonu için formatı kullanıcıdan öğrenmemiz gerek)
    return NextResponse.json({
      success: true,
      message: "Dosya başarıyla ayrıştırıldı.",
      insertedRows: data.length,
      sample: data.slice(0, 3) // İlk 3 satırı önizleme için gönder
    });
  } catch (error: any) {
    console.error("[/api/upload-pdr]", error);
    return NextResponse.json(
      { error: "Dosya işlenirken hata oluştu: " + error.message },
      { status: 500 }
    );
  }
}
