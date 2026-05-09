"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function StatisticsChart() {
  const [pendingData, setPendingData] = useState<number[]>(() => Array(12).fill(0));
  const [completedData, setCompletedData] = useState<number[]>(() => Array(12).fill(0));

  const monthLabels = useMemo(
    () => [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    []
  );

  const updateSeriesFromRows = (rows: any[]) => {
    const pending = Array(12).fill(0);
    const completed = Array(12).fill(0);

    for (const r of rows) {
      const monthIndex = Number(r.month_num || "0") - 1;
      if (monthIndex < 0 || monthIndex > 11) continue;
      pending[monthIndex] += Number(r.total_pending || 0);
      completed[monthIndex] += Number(r.total_selesai || 0);
    }

    setPendingData(pending);
    setCompletedData(completed);
  };

  const fetchStats = async (rangeFilter?: { startDate?: string; endDate?: string }) => {
    try {
      const params = new URLSearchParams();
      if (rangeFilter?.startDate) params.set("startDate", rangeFilter.startDate);
      if (rangeFilter?.endDate) params.set("endDate", rangeFilter.endDate);
      const url = params.toString() ? `/api/stats?${params.toString()}` : "/api/stats";

      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);
      const payload = await res.json();
      const rows: any[] = payload?.monthlyStats || [];

      updateSeriesFromRows(rows);
    } catch (err) {
      console.error("/api/stats error", err);
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail: any = (e as CustomEvent).detail;
        const rows: any[] = detail?.payload?.monthlyStats || [];

        if (rows.length > 0) {
          updateSeriesFromRows(rows);
          return;
        }

        if (detail?.startDate || detail?.endDate) {
          fetchStats({ startDate: detail?.startDate, endDate: detail?.endDate });
        }
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener("statsRangeChanged", handler as EventListener);

    return () => {
      window.removeEventListener("statsRangeChanged", handler as EventListener);
    };
  }, []);

  const options: ApexOptions = {
    legend: {
      show: false, // Hide legend
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#465FFF", "#9CB9FF"], // Define line colors
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 310,
      type: "line", // Set the chart type to 'line'
      toolbar: {
        show: false, // Hide chart toolbar
      },
    },
    stroke: {
      curve: "straight", // Define the line style (straight, smooth, or step)
      width: [2, 2], // Line width for each dataset
    },

    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
      },
    },
    markers: {
      size: 0, // Size of the marker points
      strokeColors: "#fff", // Marker border color
      strokeWidth: 2,
      hover: {
        size: 6, // Marker size on hover
      },
    },
    grid: {
      xaxis: {
        lines: {
          show: false, // Hide grid lines on x-axis
        },
      },
      yaxis: {
        lines: {
          show: true, // Show grid lines on y-axis
        },
      },
    },
    dataLabels: {
      enabled: false, // Disable data labels
    },
    tooltip: {
      enabled: true, // Enable tooltip
      x: {
        format: "dd MMM yyyy", // Format for x-axis tooltip
      },
    },
    xaxis: {
      type: "category", // Category-based x-axis
      categories: monthLabels,
      axisBorder: {
        show: false, // Hide x-axis border
      },
      axisTicks: {
        show: false, // Hide x-axis ticks
      },
      tooltip: {
        enabled: false, // Disable tooltip for x-axis points
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px", // Adjust font size for y-axis labels
          colors: ["#6B7280"], // Color of the labels
        },
      },
      title: {
        text: "", // Remove y-axis title
        style: {
          fontSize: "0px",
        },
      },
    },
  };

  const series = [
    {
      name: "Tiket Selesai",
      data: completedData,
    },
    {
      name: "Tiket Pending",
      data: pendingData,
    },
  ];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/3 sm:px-6 sm:pt-6">
      <div className="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
        <div className="w-full">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Statistics
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Perbandingan tiket selesai dan pending per bulan
          </p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end" />
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[1000px] xl:min-w-full">
          <Chart options={options} series={series} type="area" height={310} />
        </div>
      </div>
    </div>
  );
}