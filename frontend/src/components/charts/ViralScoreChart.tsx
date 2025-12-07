"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { motion } from "framer-motion";

interface ViralScoreChartProps {
  data: Array<{
    institution: string;
    viralScore: number;
    riskLevel: string;
  }>;
  maxInstitutions?: number;
}

const COLORS = {
  HIGH: "#EF4444",
  MEDIUM: "#F59E0B",
  LOW: "#10B981",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 shadow-xl">
        <p className="text-white font-semibold text-sm mb-2">{data.institution}</p>
        <p className="text-xs text-blue-400">
          Viral Score: <span className="text-white font-medium">{data.viralScore}</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Risk: <span className="text-white font-medium">{data.riskLevel}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function ViralScoreChart({ data, maxInstitutions = 10 }: ViralScoreChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50">
        <h3 className="text-sm font-semibold text-white mb-4">Viral Score Comparison</h3>
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  // Sort by viral score and limit
  const sortedData = [...data]
    .sort((a, b) => b.viralScore - a.viralScore)
    .slice(0, maxInstitutions)
    .map((item) => ({
      ...item,
      color: COLORS[item.riskLevel as keyof typeof COLORS] || COLORS.LOW,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50"
    >
      <h3 className="text-sm font-semibold text-white mb-4">Viral Score Comparison</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={sortedData}
          margin={{ top: 5, right: 10, left: 0, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.3)" />
          <XAxis
            dataKey="institution"
            stroke="#94a3b8"
            fontSize={11}
            tick={{ fill: "#94a3b8" }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tick={{ fill: "#94a3b8" }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#cbd5e1" }}
            iconType="square"
          />
          <Bar
            dataKey="viralScore"
            name="Viral Score"
            radius={[4, 4, 0, 0]}
          >
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

