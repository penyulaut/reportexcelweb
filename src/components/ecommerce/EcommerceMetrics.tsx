"use client";

import React, { useEffect, useState } from "react";
import Badge from "../ui/badge/Badge";
import { ArrowDownIcon, ArrowUpIcon, BoxIconLine, GroupIcon } from "@/icons";

type Totals = {
  totalTiket: number;
  totalPending: number;
  totalSelesai: number;
  totalMetResp: number;
  totalMetResol: number;
};

type Batch = {
  total_tiket?: number;
  total_pending?: number;
  total_selesai?: number;
  total_met_resp?: number;
  total_met_resol?: number;
};

type ApiResponse = {
  batches: Batch[];
};

export const EcommerceMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totals, setTotals] = useState<Totals>({
    totalTiket: 0,
    totalPending: 0,
    totalSelesai: 0,
    totalMetResp: 0,
    totalMetResol: 0,
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetch("/api/stats")
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (!mounted) return;

        const batches: Batch[] = Array.isArray(data?.batches)
          ? data.batches
          : [];

        const sums = batches.reduce(
          (acc: Totals, b: Batch) => {
            acc.totalTiket += Number(b.total_tiket ?? 0);
            acc.totalPending += Number(b.total_pending ?? 0);
            acc.totalSelesai += Number(b.total_selesai ?? 0);
            acc.totalMetResp += Number(b.total_met_resp ?? 0);
            acc.totalMetResol += Number(b.total_met_resol ?? 0);
            return acc;
          },
          {
            totalTiket: 0,
            totalPending: 0,
            totalSelesai: 0,
            totalMetResp: 0,
            totalMetResol: 0,
          }
        );

        setTotals(sums);
      })
      .catch((err) => {
        console.error("/api/stats error", err);
        setError(String(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const fmt = (v: number) => new Intl.NumberFormat().format(v);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-5 md:gap-3">
      
      <Card
        title="Total Tiket"
        value={loading ? "…" : fmt(totals.totalTiket)}
        icon={<GroupIcon className="text-gray-800 size-6 dark:text-white/90" />}
        // badge={<ArrowUpIcon />}
      />

      <Card
        title="Total Pending"
        value={loading ? "…" : fmt(totals.totalPending)}
        icon={<BoxIconLine className="text-gray-800 dark:text-white/90" />}
        // badge={<ArrowDownIcon className="text-error-500" />}
      />

      <Card
        title="Total Tiket Selesai"
        value={loading ? "…" : fmt(totals.totalSelesai)}
        icon={<BoxIconLine className="text-gray-800 dark:text-white/90" />}
        // badge={<ArrowDownIcon className="text-error-500" />}
      />

      <Card
        title="Total Met Response"
        value={loading ? "…" : fmt(totals.totalMetResp)}
        icon={<BoxIconLine className="text-gray-800 dark:text-white/90" />}
        // badge={<ArrowDownIcon className="text-error-500" />}
      />

      <Card
        title="Total Met Resolution"
        value={loading ? "…" : fmt(totals.totalMetResol)}
        icon={<BoxIconLine className="text-gray-800 dark:text-white/90" />}
        // badge={<ArrowDownIcon className="text-error-500" />}
      />

      {error && (
        <div className="col-span-5 text-red-500 mt-2">
          Error: {error}
        </div>
      )}
    </div>
  );
};

function Card({
  title,
  value,
  icon,
  // badge,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  // badge: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 md:p-6">
      <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
        {icon}
      </div>

      <div className="flex items-end justify-between mt-5">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {title}
          </span>
          <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
            {value}
          </h4>
        </div>

        {/* <Badge color="error">{badge}</Badge> */}
      </div>
    </div>
  );
}