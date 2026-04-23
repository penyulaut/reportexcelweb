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
    <div className="page-root">
      {/* BG blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <main className="card">
        {/* Logo / title area */}
        <div className="header-area">
          <div className="icon-wrap">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="48" height="48" rx="12" fill="url(#grad)" />
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <path d="M14 12h13l7 7v17H14V12z" fill="white" fillOpacity=".15" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M27 12v7h7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="18" y="24" width="12" height="2" rx="1" fill="white" fillOpacity=".8" />
              <rect x="18" y="29" width="8" height="2" rx="1" fill="white" fillOpacity=".6" />
              <circle cx="34" cy="34" r="7" fill="#22d3ee" />
              <path d="M31 34l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="title">Log DTE Converter</h1>
          <p className="subtitle">
            Upload spreadsheet SLA&nbsp;(.xlsx) → generate dokumen Log Dukungan Teknis (.docx) otomatis
          </p>
        </div>

        {/* Steps indicator */}
        <div className="steps">
          <div className={`step ${file || state.status !== "idle" ? "done" : "active"}`}>
            <span className="step-num">1</span>
            <span className="step-label">Upload XLSX</span>
          </div>
          <div className="step-line" />
          <div className={`step ${state.status === "success" ? "done" : state.status === "uploading" ? "active" : ""}`}>
            <span className="step-num">2</span>
            <span className="step-label">Konversi</span>
          </div>
          <div className="step-line" />
          <div className={`step ${state.status === "success" ? "active" : ""}`}>
            <span className="step-num">3</span>
            <span className="step-label">Download</span>
          </div>
        </div>

        {/* Drop zone */}
        <div
          id="dropzone"
          className={`dropzone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""} ${state.status === "uploading" ? "loading" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Upload area"
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            id="file-input"
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {state.status === "uploading" ? (
            <div className="dz-content">
              <div className="spinner" aria-label="Converting..." />
              <p className="dz-primary">Sedang mengonversi…</p>
              <p className="dz-secondary">Harap tunggu sebentar</p>
            </div>
          ) : file ? (
            <div className="dz-content">
              <div className="file-icon">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M6 4h19l9 9v23H6V4z" fill="#22c55e" fillOpacity=".15" stroke="#22c55e" strokeWidth="1.5" />
                  <path d="M25 4v9h9" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M13 20h14M13 25h10" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="dz-primary">{file.name}</p>
              <p className="dz-secondary">{(file.size / 1024).toFixed(1)} KB · Klik untuk ganti file</p>
            </div>
          ) : (
            <div className="dz-content">
              <div className="upload-icon">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
                  <path d="M20 28V14M13 21l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="dz-primary">Drag &amp; drop file XLSX di sini</p>
              <p className="dz-secondary">atau <span className="dz-link">klik untuk browse</span></p>
            </div>
          )}
        </div>

        {/* Error message */}
        {state.status === "error" && (
          <div className="alert alert-error" role="alert">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5h2v2H9v-2zm0-8h2v6H9V5z" clipRule="evenodd" />
            </svg>
            <span>{state.message}</span>
          </div>
        )}

        {/* Success result */}
        {state.status === "success" && (
          <div className="success-panel">
            <div className="success-icon">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="20" cy="20" r="20" fill="#22c55e" fillOpacity=".15" />
                <path d="M12 20l6 6 10-12" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="success-info">
              <p className="success-title">Konversi berhasil!</p>
              <p className="success-details">
                <span className="badge">Periode: {state.periode}</span>
                <span className="badge">{state.tickets} tiket</span>
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="actions">
          {state.status === "success" ? (
            <>
              <button id="btn-download" className="btn btn-primary" onClick={downloadFile}>
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-5.707a1 1 0 011.414 0L9 12.586V5a1 1 0 012 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download {state.filename}
              </button>
              <button id="btn-reset" className="btn btn-ghost" onClick={reset}>
                Konversi Lagi
              </button>
            </>
          ) : (
            <button
              id="btn-convert"
              className="btn btn-primary"
              onClick={handleConvert}
              disabled={!file || state.status === "uploading"}
            >
              {state.status === "uploading" ? (
                <>
                  <div className="btn-spinner" />
                  Mengonversi…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Generate Dokumen
                </>
              )}
            </button>
          )}
        </div>

        {/* Info note */}
        <div className="info-note">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8 16A8 8 0 108 0a8 8 0 000 16zm.75-11.25a.75.75 0 10-1.5 0v4.5a.75.75 0 001.5 0v-4.5zm-.75 8a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
          Tab <strong>All</strong> dari XLSX digunakan · Header Periode &amp; Tanggal otomatis diisi · Top&nbsp;5 ringkasan berdasarkan frekuensi · Diurutkan berdasarkan PIC
        </div>
      </main>
    </div>
  );
}
