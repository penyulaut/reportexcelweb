"use client";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { MoreDotIcon } from "@/icons";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useState, useEffect, useRef } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import flatpickr from "flatpickr";
import ChartTab from "../common/ChartTab";
import { CalenderIcon } from "../../icons";


// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type MonthlyData = {
  month: string;
  totalTiket: number;
};

export default function MonthlySalesChart() {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [salesData, setSalesData] = useState<number[]>([]);
  const [range, setRange] = useState<"monthly" | "quarterly" | "annually">("monthly");
  const [yearFilter, setYearFilter] = useState<string | undefined>(undefined);
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  // Fetch stats from API and transform based on selected range
  async function fetchStats(selectedRange: typeof range, year?: string) {
    try {
      const url = year ? `/api/stats?year=${encodeURIComponent(year)}` : "/api/stats";
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);
      const payload = await res.json();
      const rows: any[] = payload.monthlyStats || [];

      if (selectedRange === "monthly") {
        // sort by month_num ascending (01..12)
        const sorted = [...rows].sort((a, b) => (a.month_num || "00").localeCompare(b.month_num || "00"));
        const months = sorted.map((r) => r.month_name);
        const totals = sorted.map((r) => Number(r.total_tickets));
        setCategories(months);
        setSalesData(totals);
      } else if (selectedRange === "quarterly") {
        // group into quarters within each year
        const map = new Map<string, number>();
        rows.forEach((r) => {
          const m = Number(r.month_num || "0");
          const q = Math.ceil(m / 3) || 1;
          const y = r.year || (year ?? "");
          const key = `${y}-Q${q}`;
          const prev = map.get(key) || 0;
          map.set(key, prev + Number(r.total_tickets || 0));
        });
        const items = Array.from(map.entries()).map(([k, v]) => ({ k, v })).sort((a, b) => a.k.localeCompare(b.k));
        const cats = items.map((it) => {
          const [, q] = it.k.split("-");
          return `${q} ${it.k.split("-")[0]}`;
        });
        const vals = items.map((it) => it.v);
        setCategories(cats);
        setSalesData(vals);
      } else {
        // annually: sum per year
        const map = new Map<string, number>();
        rows.forEach((r) => {
          const y = r.year || (year ?? "");
          const prev = map.get(y) || 0;
          map.set(y, prev + Number(r.total_tickets || 0));
        });
        const items = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const cats = items.map((it) => it[0]);
        const vals = items.map((it) => it[1]);
        setCategories(cats);
        setSalesData(vals);
      }

      // Notify other components (like metrics) so they can update without refetching if desired
      try {
        window.dispatchEvent(new CustomEvent("statsRangeChanged", { detail: { range: selectedRange, year, payload } }));
      } catch (e) {
        // ignore if running server-side or event can't be dispatched
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }

  useEffect(() => {
    // initial fetch
    fetchStats(range, yearFilter);
    return () => {};
  }, []);

  // init flatpickr for year selection
  useEffect(() => {
    if (!datePickerRef.current) return;
    const fp = (flatpickr as any)(datePickerRef.current, {
      dateFormat: "Y",
      allowInput: false,
      onChange: (selectedDates: Date[]) => {
        const y = selectedDates?.[0]?.getFullYear?.()?.toString();
        setYearFilter(y);
        fetchStats(range, y);
      },
    });
    return () => {
      try {
        fp?.destroy();
      } catch (e) {}
    };
  }, [datePickerRef.current, range]);

  const options: ApexOptions = {
    colors: ["#465fff"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 180,
      toolbar: {
        show: false, 
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "10%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
      categories: categories,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },
    yaxis: {
      title: {
        text: undefined,
      },
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },

    tooltip: {
      x: {
        show: false,
      },
      y: {
        formatter: (val: number) => `${val}`,
      },
    },
  };
  const series = [
    {
      name: "Total Tiket",
      data: salesData,
    },
  ];

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/3 sm:px-6 sm:pt-6">
      <div className="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
        <div className="w-full">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Report
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Lihat Report Total Tiket yang sudah dibuat perbulan
          </p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <ChartTab selected={range} onChange={(r) => { setRange(r); fetchStats(r, yearFilter); }} />
          <div className="relative inline-flex items-center">
            <CalenderIcon className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:left-3 lg:top-1/2 lg:translate-x-0 lg:-translate-y-1/2  text-gray-500 dark:text-gray-400 pointer-events-none z-10" />
            <input
              ref={datePickerRef}
              className="h-10 w-10 lg:w-40 lg:h-auto  lg:pl-10 lg:pr-3 lg:py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-transparent lg:text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-800 dark:lg:text-gray-300 cursor-pointer"
              placeholder="Select date range"
            />
          </div>
        </div>
      </div>
      

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
          <ReactApexChart
            options={options}
            series={series}
            type="bar"
            height={388}
          />
        </div>
      </div>
    </div>
  );
}
