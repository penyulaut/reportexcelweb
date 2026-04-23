import type { Metadata } from "next";
import "./convert.css";

export const metadata: Metadata = {
  title: "Log DTE Converter | SLA XLSX → DOCX",
  description: "Konversi spreadsheet SLA ke dokumen Log Dukungan Teknis secara otomatis.",
};

export default function ConvertLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-full flex flex-col">{children}</div>;
}
