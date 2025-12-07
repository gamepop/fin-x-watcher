"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";

interface RiskDistributionChartProps {
  data: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
}

const COLORS = {
  HIGH: "#EF4444",
  MEDIUM: "#F59E0B",
  LOW: "#10B981",
};

// Custom tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const percent = ((data.value / (data.payload.total || 1)) * 100).toFixed(0);
    return (
      <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 shadow-xl">
        <p className="text-white font-semibold text-sm">{data.name}</p>
        <p className="text-slate-300 text-xs">
          Count: <span className="text-white font-medium">{data.value}</span>
        </p>
        <p className="text-slate-300 text-xs">
          Percentage: <span className="text-white font-medium">{percent}%</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function RiskDistributionChart({ data }: RiskDistributionChartProps) {
  const chartData = [
    { name: "HIGH", value: data.HIGH, color: COLORS.HIGH },
    { name: "MEDIUM", value: data.MEDIUM, color: COLORS.MEDIUM },
    { name: "LOW", value: data.LOW, color: COLORS.LOW },
  ].filter((item) => item.value > 0);

  const total = data.HIGH + data.MEDIUM + data.LOW;

  if (total === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50">
        <h3 className="text-sm font-semibold text-white mb-4">Risk Distribution</h3>
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  // Add total to each data point for tooltip
  const chartDataWithTotal = chartData.map((item) => ({
    ...item,
    total,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50"
    >
      <h3 className="text-sm font-semibold text-white mb-4">Risk Distribution</h3>
      
      {/* Chart Container */}
      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chartDataWithTotal}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={false}
              outerRadius={65}
              innerRadius={25}
              fill="#8884d8"
              dataKey="value"
              stroke="rgba(30, 41, 59, 0.5)"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Custom Legend - Cleaner and more reliable */}
        <div className="mt-4 w-full">
          <div className="grid grid-cols-3 gap-3">
            {chartData.map((item) => {
              const percent = total > 0 ? ((item.value / total) * 100).toFixed(0) : "0";
              return (
                <div
                  key={item.name}
                  className="flex flex-col items-center p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-semibold text-white">{item.name}</span>
                  </div>
                  <div className="text-lg font-bold text-white">{item.value}</div>
                  <div className="text-xs text-slate-400">{percent}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

