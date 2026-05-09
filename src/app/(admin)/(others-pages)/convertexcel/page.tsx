"use client";

import { useState, useRef, useCallback } from "react";

type ConvertState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; filename: string; periode: string; tickets: number; blobUrl: string }
  | { status: "error"; message: string };

export default function Home() {
  const [state, setState] = useState<ConvertState>({ status: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.match(/\.xlsx$/i)) {
      setState({ status: "error", message: "File harus berformat .xlsx" });
      return;
    }
    setFile(f);
    setState({ status: "idle" });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleConvert = async () => {
    if (!file) return;
    setState({ status: "uploading" });

    const form = new FormData();
    form.append("xlsx", file);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: form });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setState({ status: "error", message: json.error ?? "Konversi gagal" });
        return;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const filename = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "output.docx";
      const periode = res.headers.get("X-Periode") ?? "";
      const tickets = Number(res.headers.get("X-Tickets") ?? 0);

      setState({ status: "success", filename, periode, tickets, blobUrl });
    } catch (err) {
      setState({ status: "error", message: String(err) });
    }
  };

  const downloadFile = () => {
    if (state.status !== "success") return;
    const a = document.createElement("a");
    a.href = state.blobUrl;
    a.download = state.filename;
    a.click();
  };

  const reset = () => {
    if (state.status === "success") URL.revokeObjectURL(state.blobUrl);
    setFile(null);
    setState({ status: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
  {/* Background Blur */}
  {/* <div className="absolute top-0 left-0 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" /> */}
  {/* <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" /> */}

  <main className="relative z-10 mx-auto max-w-3xl p-6">
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xl dark:border-white/10 dark:bg-white/5">
      
      {/* Header */}
      <div className="border-b border-gray-100 px-8 py-8 dark:border-white/10">
        <div className="flex flex-col items-center text-center">
          
          {/* Logo */}
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500 dark:bg-brand-500/20">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10"
            >
              <rect
                width="48"
                height="48"
                rx="12"
                fill="currentColor"
                fillOpacity="0.15"
              />
              <path
                d="M14 12h13l7 7v17H14V12z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M27 12v7h7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="18"
                y="24"
                width="12"
                height="2"
                rx="1"
                fill="currentColor"
              />
              <rect
                x="18"
                y="29"
                width="8"
                height="2"
                rx="1"
                fill="currentColor"
                opacity="0.7"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Dashboard Converter
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            Upload file Excel (.xlsx) untuk menghasilkan dokumen laporan secara otomatis dengan tampilan modern dan cepat.
          </p>
        </div>

        {/* Steps */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              file || state.status !== "idle"
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
            }`}
          >
            <span>1</span>
            <span>Upload</span>
          </div>

          <div className="h-px w-10 bg-gray-300 dark:bg-white/10" />

          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              state.status === "uploading" || state.status === "success"
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
            }`}
          >
            <span>2</span>
            <span>Proses</span>
          </div>

          <div className="h-px w-10 bg-gray-300 dark:bg-white/10" />

          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              state.status === "success"
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
            }`}
          >
            <span>3</span>
            <span>Download</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        
        {/* Upload Area */}
        <div
          id="dropzone"
          className={`group cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
            dragOver
              ? "border-brand-500 bg-brand-500/5"
              : "border-gray-300 hover:border-brand-400 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/5"
          } ${
            state.status === "uploading"
              ? "pointer-events-none opacity-80"
              : ""
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Upload area"
          onKeyDown={(e) =>
            e.key === "Enter" && inputRef.current?.click()
          }
        >
          <input
            ref={inputRef}
            id="file-input"
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {state.status === "uploading" ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />

              <p className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Sedang Memproses...
              </p>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Mohon tunggu beberapa saat
              </p>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 text-green-500">
                <svg
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                >
                  <path
                    d="M6 4h19l9 9v23H6V4z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M25 4v9h9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              <p className="text-base font-semibold text-gray-800 dark:text-white/90">
                {file.name}
              </p>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {(file.size / 1024).toFixed(1)} KB • Klik untuk mengganti file
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/10 text-brand-500">
                <svg
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                >
                  <circle
                    cx="20"
                    cy="20"
                    r="19"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                  <path
                    d="M20 28V14M13 21l7-7 7 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <p className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Upload File Excel
              </p>

              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Drag & drop file .xlsx atau klik untuk memilih file
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {state.status === "error" && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10">
            {state.message}
          </div>
        )}

        {/* Success */}
        {state.status === "success" && (
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-500/20 dark:bg-green-500/10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-green-500">
              <svg
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7"
              >
                <path
                  d="M12 20l6 6 10-12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <p className="text-base font-semibold text-gray-800 dark:text-white/90">
                Dokumen berhasil dibuat
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm dark:bg-white/10 dark:text-gray-300">
                  Periode: {state.periode}
                </span>

                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm dark:bg-white/10 dark:text-gray-300">
                  {state.tickets} tiket
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {state.status === "success" ? (
            <>
              <button
                id="btn-download"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-600"
                onClick={downloadFile}
              >
                Download {state.filename}
              </button>

              <button
                id="btn-reset"
                className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-white/90 dark:hover:bg-white/10"
                onClick={reset}
              >
                Upload Lagi
              </button>
            </>
          ) : (
            <button
              id="btn-convert"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleConvert}
              disabled={!file || state.status === "uploading"}
            >
              {state.status === "uploading" ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Memproses...
                </>
              ) : (
                <>Generate Dokumen</>
              )}
            </button>
          )}
        </div>

        {/* Info */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
          File Excel akan diproses secara otomatis dan menghasilkan dokumen laporan sesuai format sistem.
        </div>
      </div>
    </div>
  </main>
</div>
  );
}
