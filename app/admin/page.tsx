"use client";

import { useState } from "react";
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setMessage({ text: "Excel dosyası işleniyor ve veritabanına kaydediliyor... Bu işlem biraz zaman alabilir.", type: "info" });

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

      setMessage({ text: `Başarılı! ${data.insertedRows} adet hisse kaydı eklendi/güncellendi.`, type: "success" });
      setFile(null);
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 text-gray-200" style={{ backgroundColor: "var(--bg-base)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Yönetici Paneli</h1>
          <p className="text-gray-400">
            TEFAS fonlarının detaylı hisse senedi dağılımını (PDR) sisteme yükleyin. KAP'tan indirdiğiniz Excel veya CSV formatındaki Portföy Dağılım Raporunu buradan veritabanına aktarabilirsiniz.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-400" />
              PDR Excel Yükle
            </h2>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-gray-500 transition-colors">
              <input
                type="file"
                id="pdr-upload"
                className="hidden"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
              />
              <label
                htmlFor="pdr-upload"
                className="cursor-pointer flex flex-col items-center justify-center gap-3"
              >
                <UploadCloud className="w-10 h-10 text-gray-400" />
                <span className="text-sm text-gray-300">
                  {file ? file.name : "Dosya seçmek için tıklayın veya sürükleyin"}
                </span>
                <span className="text-xs text-gray-500">.xlsx, .xls veya .csv desteklenir</span>
              </label>
            </div>

            {message && (
              <div
                className={`p-4 rounded-lg flex items-start gap-3 ${
                  message.type === "success"
                    ? "bg-green-500/10 border border-green-500/20 text-green-400"
                    : message.type === "error"
                    ? "bg-red-500/10 border border-red-500/20 text-red-400"
                    : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : message.type === "error" ? (
                  <AlertCircle className="w-5 h-5 shrink-0" />
                ) : (
                  <UploadCloud className="w-5 h-5 shrink-0 animate-pulse" />
                )}
                <p className="text-sm">{message.text}</p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                !file || loading
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
              }`}
            >
              {loading ? "Yükleniyor..." : "Veritabanına Aktar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
