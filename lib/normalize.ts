/**
 * Ham TEFAS verisi → UI'ın beklediği HOLDINGS formatı dönüşümü.
 * t (güncel) ve t-1 (önceki dönem) holdingler karşılaştırılır.
 */

import type { TefasFund, TefasHolding } from "./tefas";

export type HoldingStatus = "new" | "exit" | "increase" | "decrease" | "unchanged";

export interface Holding {
  fundCode: string;
  stock: string;
  qtyT1: number;
  qtyT: number;
  weightT1: number;
  weightT: number;
  status: HoldingStatus;
  deltaWeight: number;
  deltaQty: number;
  /** PDR dönem tarihi (güncel: t) */
  reportDate: string;
  /** Önceki PDR dönem tarihi (t-1) */
  prevReportDate: string;
  /** Bu hissenin bu fona giriş tarihi (ilk kez göründüğü PDR tarihi) */
  entryDate?: string;
  /** Bu hissenin bu fondan çıkış tarihi */
  exitDate?: string;
}

export interface StockMeta {
  ticker: string;
  name: string;
  sector: string;
}

export interface NormalizedData {
  funds: TefasFund[];
  stocks: StockMeta[];
  holdings: Holding[];
  reportDate: string;
  prevReportDate: string;
  fetchedAt: string;
}

function classify(qtyT1: number, qtyT: number): HoldingStatus {
  if (qtyT1 === 0 && qtyT > 0) return "new";
  if (qtyT1 > 0 && qtyT === 0) return "exit";
  if (qtyT > qtyT1) return "increase";
  if (qtyT < qtyT1) return "decrease";
  return "unchanged";
}

/**
 * İki dönem TEFAS verisini birleştirip Holding dizisi üretir.
 */
export function normalizeHoldings(
  currentRows: TefasHolding[],
  prevRows: TefasHolding[],
  reportDate: string,
  prevReportDate: string,
  fetchedAt: string
): NormalizedData {
  // Önceki dönem hızlı erişim map'i: "FUNDCODE:STOCK" → TefasHolding
  const prevMap = new Map<string, TefasHolding>();
  prevRows.forEach((h) => prevMap.set(`${h.fundCode}:${h.stock}`, h));

  // Güncel dönem map'i
  const currMap = new Map<string, TefasHolding>();
  currentRows.forEach((h) => currMap.set(`${h.fundCode}:${h.stock}`, h));

  // Tüm benzersiz anahtar kombinasyonları
  const allKeys = new Set([...prevMap.keys(), ...currMap.keys()]);

  // Hisse ve fon meta verisi topla
  const stocksMap = new Map<string, StockMeta>();
  const fundsMap = new Map<string, TefasFund>();

  [...prevRows, ...currentRows].forEach((h) => {
    if (!stocksMap.has(h.stock)) {
      stocksMap.set(h.stock, {
        ticker: h.stock,
        name: h.stockName || h.stock,
        sector: h.sector || "Diğer",
      });
    }
  });

  const holdings: Holding[] = [];

  allKeys.forEach((key) => {
    const curr = currMap.get(key);
    const prev = prevMap.get(key);

    const qtyT1 = prev?.qty ?? 0;
    const qtyT = curr?.qty ?? 0;
    const weightT1 = prev?.weight ?? 0;
    const weightT = curr?.weight ?? 0;

    // İkisi de sıfırsa atla
    if (qtyT1 === 0 && qtyT === 0) return;

    const ref = curr ?? prev!;
    const status = classify(qtyT1, qtyT);

    holdings.push({
      fundCode: ref.fundCode,
      stock: ref.stock,
      qtyT1,
      qtyT,
      weightT1,
      weightT,
      status,
      deltaWeight: Number((weightT - weightT1).toFixed(2)),
      deltaQty: qtyT - qtyT1,
      reportDate,
      prevReportDate,
      // entryDate / exitDate D1'den gelecek; API route'da doldurulur
    });
  });

  return {
    funds: Array.from(fundsMap.values()),
    stocks: Array.from(stocksMap.values()),
    holdings,
    reportDate,
    prevReportDate,
    fetchedAt,
  };
}
