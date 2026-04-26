"use client";

import { useEffect, useState, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";

interface Ticket {
  no: number;
  tiket: string;
  ringkasan: string;
  rincian: string;
  pemohon: string;
  solusi: string;
  tipe: string;
  tanggal: string;
  pic: string;
  slaRespon: string;
  slaResol: string;
}

interface PreviewData {
  periode: string;
  totalTiket: number;
  duplicateCount?: number;
  tickets: Ticket[];
}

export default function LogExportPage() {
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [years, setYears] = useState<number[]>([]);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const months = [
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
  ];

  // Fetch available years on mount
  useEffect(() => {
    async function fetchYears() {
      try {
        const res = await fetch("/api/export?type=years");
        if (!res.ok) throw new Error("Failed to fetch years");
        const data = await res.json();
        setYears(data.years);
        if (data.years.length > 0) {
          setSelectedYear(String(data.years[0]));
        }
      } catch (err) {
        console.error("Error fetching years:", err);
        setError("Gagal memuat data tahun");
      }
    }
    fetchYears();
  }, []);

  // Fetch preview when year/month changes
  const fetchPreview = useCallback(async () => {
    if (!selectedYear) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/export?type=preview&year=${selectedYear}${selectedMonth ? `&month=${selectedMonth}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch preview");
      }
      const data = await res.json();
      setPreviewData(data);
    } catch (err) {
      console.error("Error fetching preview:", err);
      setError(err instanceof Error ? err.message : "Gagal memuat preview data");
      setPreviewData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  async function handleExport() {
    setExportLoading(true);
    setError(null);

    try {
      if (!selectedYear) {
        setError("Pilih tahun terlebih dahulu");
        setExportLoading(false);
        return;
      }

      const body: Record<string, string> = {
        year: selectedYear,
      };
      if (selectedMonth) {
        body.month = selectedMonth;
      }

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Export failed");
      }

      // Download file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = "Report.docx";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
      setError(err instanceof Error ? err.message : "Export gagal");
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Log Export" />

      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold mb-6">Log Export - Preview & Export</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {/* Date Filter Section */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mb-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Pilih Periode
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tahun
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">-- Pilih Tahun --</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bulan (Opsional)
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={!selectedYear}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">-- Semua Bulan --</option>
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Preview Data
                {previewData && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({previewData.totalTiket} tiket unik, menampilkan 5 pertama)
                    {previewData.duplicateCount && previewData.duplicateCount > 0 && (
                      <span className="text-amber-600 ml-1">
                        - {previewData.duplicateCount} duplikat ditemukan dan diabaikan
                      </span>
                    )}
                  </span>
                )}
              </h3>
              {loading && (
                <span className="text-sm text-gray-500">Loading...</span>
              )}
            </div>

            {previewData && previewData.tickets.length > 0 ? (
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                <table className="w-full text-sm text-gray-800 dark:text-gray-200">
                  <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold">
                    <tr>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center w-12">No</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">No Tiket</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">Permintaan<br/><span className="text-xs font-normal">(Ringkasan)</span></th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">Pemohon<br/><span className="text-xs font-normal">(Rincian)</span></th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">Solusi</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">Tipe</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">Tanggal</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">PIC</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center" colSpan={2}>SLA</th>
                    </tr>
                    <tr>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1"></th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1"></th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-normal">Ringkasan</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-normal">Rincian</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1"></th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1"></th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1"></th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1"></th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs">Respon</th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs">Resolusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {previewData.tickets.slice(0, 5).map((ticket, idx) => (
                      <tr
                        key={`${ticket.tiket}-${idx}`}
                        className={`${
                          idx % 2 === 0
                            ? "bg-white dark:bg-gray-800"
                            : "bg-gray-50 dark:bg-gray-800/60"
                        } hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors`}
                      >
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">{ticket.no}</td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2">{ticket.tiket}</td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 max-w-xs truncate" title={ticket.ringkasan}>
                          {ticket.ringkasan}
                        </td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 max-w-xs truncate" title={ticket.rincian || ticket.pemohon}>
                          {ticket.rincian || ticket.pemohon}
                        </td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 max-w-xs truncate" title={ticket.solusi}>
                          {ticket.solusi}
                        </td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">{ticket.tipe}</td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">{ticket.tanggal}</td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">{ticket.pic}</td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">{ticket.slaRespon}</td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-center">{ticket.slaResol}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-gray-500">
                  {loading ? "Memuat data..." : "Tidak ada data untuk periode yang dipilih"}
                </p>
              </div>
            )}
          </div>

          {/* Export Button */}
          <div className="flex justify-center pt-6 border-t">
            <Button
              onClick={handleExport}
              disabled={exportLoading || loading || !previewData || previewData.tickets.length === 0}
              size="md"
            >
              {exportLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sedang Export...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Semua ke Word (.docx)
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Catatan:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Preview menampilkan 5 tiket pertama dari periode yang dipilih</li>
              <li>Export akan mengexport semua tiket ({previewData?.totalTiket || 0} tiket unik) ke file Word</li>
              <li>Duplikat berdasarkan No Tiket akan diabaikan secara otomatis</li>
              <li>Format file .docx sesuai template yang sudah diatur</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
