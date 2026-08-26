"use client";

import { useState } from "react";
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, RefreshCw, Database, ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [syncStats, setSyncStats] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleSyncKAP = async () => {
    setSyncLoading(true);
    setMessage({ text: "KAP ve TEFAS sistemlerine bağlanılıyor, fonlar ve hisse dağılımları D1 veritabanına aktarılıyor...", type: "info" });
    try {
      const res = await fetch("/api/sync-kap", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Senkronizasyon hatası oluştu.");
      setSyncStats(data.stats);
      setMessage({
        text: `Harika! ${data.stats.insertedFunds} fon ve ${data.stats.insertedHoldings} hisse dağılım kaydı D1 veritabanına başarıyla senkronize edildi.`,
        type: "success",
      });
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setMessage({ text: "Excel dosyası işleniyor ve veritabanına kaydediliyor...", type: "info" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-pdr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Yükleme sırasında bir hata oluştu.");
      }

      setMessage({ text: `Başarılı! ${data.insertedRows} adet hisse kaydı eklendi.`, type: "success" });
      setFile(null);
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 text-gray-200 bg-[#0a0d14]">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-800 hover:border-gray-700 bg-gray-900/60 transition-all text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Ana Grafiğe Dön
          </Link>
          <div className="flex items-center gap-2 text-xs text-purple-400 font-mono">
            <Database className="w-4 h-4" /> Cloudflare D1 Entegrasyonu
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Veri Yönetim & Senkronizasyon Paneli</h1>
          <p className="text-sm text-gray-400">
            TEFAS hisse senedi yoğun (HSYF) ve serbest fonlarının hisse dağılımlarını KAP üzerinden otomatik çekin veya elinizdeki Excel raporlarını içe aktarın.
          </p>
        </div>

        {/* 1. KART: OTOMATİK KAP SENKRONİZASYON */}
        <div className="p-6 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-gray-900/60 to-gray-900/90 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              KAP & TEFAS Otomatik Veri Senkronizasyonu
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Canlı / Otomatik
            </span>
          </div>

          <p className="text-xs text-gray-400 mb-5 leading-relaxed">
            Bu butona bastığınızda sistem KAP PDR bildirimlerini ve TEFAS fon listesini otomatik olarak tarar, hisse dağılımlarını ayıklar ve Cloudflare D1 veritabanına doğrudan kaydeder.
          </p>

          <button
            onClick={handleSyncKAP}
            disabled={syncLoading}
            className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              syncLoading
                ? "bg-purple-900/50 text-purple-300 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncLoading ? "animate-spin" : ""}`} />
            {syncLoading ? "Senkronizasyon Yapılıyor…" : "KAP'tan Otomatik Çek ve Veritabanını Güncelle"}
          </button>
        </div>

        {/* 2. KART: MANUEL EXCEL YÜKLEME */}
        <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              Manuel PDR Excel / CSV Yükle
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
              Yedek / Manuel
            </span>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
              <input
                type="file"
                id="pdr-upload"
                className="hidden"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
              />
              <label
                htmlFor="pdr-upload"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <UploadCloud className="w-8 h-8 text-gray-400" />
                <span className="text-xs text-gray-300">
                  {file ? file.name : "KAP'tan indirdiğiniz Excel dosyasını seçin"}
                </span>
                <span className="text-[11px] text-gray-500">.xlsx, .xls veya .csv desteklenir</span>
              </label>
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-all ${
                !file || loading
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
              }`}
            >
              {loading ? "Yükleniyor..." : "Excel'i Veritabanına Aktar"}
            </button>
          </div>
        </div>

        {/* BİLDİRİM / MESAJ */}
        {message && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 text-xs ${
              message.type === "success"
                ? "bg-green-500/10 border border-green-500/20 text-green-400"
                : message.type === "error"
                ? "bg-red-500/10 border border-red-500/20 text-red-400"
                : "bg-purple-500/10 border border-purple-500/20 text-purple-300"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
            ) : message.type === "error" ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            ) : (
              <RefreshCw className="w-5 h-5 shrink-0 animate-spin text-purple-400" />
            )}
            <p className="leading-relaxed">{message.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}
