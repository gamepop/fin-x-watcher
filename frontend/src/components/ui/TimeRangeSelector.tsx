"use client";

import { motion } from "framer-motion";

export type TimeRange = "1h" | "6h" | "24h" | "7d";

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
];

export default function TimeRangeSelector({
  value,
  onChange,
  className = "",
}: TimeRangeSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-slate-400 font-medium">Time Range:</span>
      <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1">
        {timeRanges.map((range) => (
          <button
            key={range.value}
            onClick={() => onChange(range.value)}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              value === range.value
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                : "text-slate-300 hover:text-white hover:bg-slate-600/50"
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
}

