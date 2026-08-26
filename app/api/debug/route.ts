/**
 * GET /api/debug — TEFAS parametre denemeleri v3
 */
import { NextResponse } from "next/server";

const BASE = "https://www.tefas.gov.tr";
const HEADERS = {
  Accept: "*/*",
  "Content-Type": "application/json",
  Origin: BASE,
  Referer: `${BASE}/tr/fon-verileri`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
};

export const runtime = "edge";

async function tryFetch(label: string, url: string, body: unknown) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 800); }
    return { label, status: r.status, body: parsed };
  } catch (e) {
    return { label, error: String(e) };
  }
}

export async function GET() {
  const LIST_URL  = `${BASE}/api/funds/fonGnlBlgSiraliGetir`;
  const DIST_URL  = `${BASE}/api/funds/dagilimSiraliGetirT`;
  const PRICE_URL = `${BASE}/api/funds/fonFiyatBilgiGetir`;

  const results = await Promise.all([
    // Fon listesi — pagination ile
    tryFetch("list_paginated", LIST_URL, { sayfa: 1, sayfaBasina: 10, tarih: "25.07.2026" }),
    tryFetch("list_no_params", LIST_URL, {}),
    tryFetch("list_kategori", LIST_URL, { fonKategori: "YAT" }),

    // Dağılım — fon kodu ile
    tryFetch("dist_with_fonkodu", DIST_URL, { fonKodu: "TLY", tarih: "25.07.2026" }),
    tryFetch("dist_no_tarih",     DIST_URL, { fonKodu: "TLY" }),
    tryFetch("dist_no_fonkodu",   DIST_URL, { tarih: "25.07.2026" }),

    // Fiyat — farklı periyotlar
    tryFetch("price_periyod1",  PRICE_URL, { fonKodu: "TLY", periyod: 1 }),
    tryFetch("price_startend",  PRICE_URL, { fonKodu: "TLY", baslangicTarihi: "01.07.2026", bitisTarihi: "25.07.2026" }),

    // Fon bilgisi endpoint — belki farklı bir tane
    tryFetch("fon_bilgi", `${BASE}/api/funds/fonGetiriBazliBilgiGetir`, { fonKodu: "TLY", periyod: 1 }),
  ]);

  return NextResponse.json(
    Object.fromEntries(results.map((r) => [r.label, r])),
    { status: 200 }
  );
}
