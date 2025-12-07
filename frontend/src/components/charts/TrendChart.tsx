"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";

interface TrendChartProps {
  institution?: string;
  timeRange?: "1h" | "6h" | "24h" | "7d";
  data: Array<{
    time: string;
    volume: number;
    viralScore?: number;
  }>;
  showViralScore?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 shadow-xl">
        <p className="text-white font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: <span className="text-white font-medium">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrendChart({
  institution,
  timeRange = "24h",
  data,
  showViralScore = false,
}: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50">
        <h3 className="text-sm font-semibold text-white mb-4">
          {institution ? `${institution} Trends` : "Trend Chart"}
        </h3>
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          {institution ? `${institution} Trends` : "Tweet Volume Trend"}
        </h3>
        <span className="text-xs text-slate-400 px-2 py-1 rounded bg-slate-700/50">
          {timeRange}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.3)" />
          <XAxis
            dataKey="time"
            stroke="#94a3b8"
            fontSize={12}
            tick={{ fill: "#94a3b8" }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tick={{ fill: "#94a3b8" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="volume"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: "#3b82f6", r: 3 }}
            activeDot={{ r: 5 }}
            name="Tweet Volume"
          />
          {showViralScore && (
            <Line
              type="monotone"
              dataKey="viralScore"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: "#8b5cf6", r: 3 }}
              activeDot={{ r: 5 }}
              name="Viral Score"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

