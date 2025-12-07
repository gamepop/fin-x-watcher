"use client";

import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface InstitutionData {
  institution: string;
  riskLevel: string;
  viralScore: number;
  trendVelocity: number;
  tweetCount: number;
}

interface ComparisonViewProps {
  institutions: InstitutionData[];
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
        <div className="space-y-1 text-xs">
          <p className="text-blue-400">
            Viral Score: <span className="text-white font-medium">{data.viralScore}</span>
          </p>
          <p className="text-slate-400">
            Risk: <span className="text-white font-medium">{data.riskLevel}</span>
          </p>
          <p className="text-slate-400">
            Tweets: <span className="text-white font-medium">{data.tweetCount}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function ComparisonView({
  institutions,
  maxInstitutions = 5,
}: ComparisonViewProps) {
  if (!institutions || institutions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50">
        <h3 className="text-sm font-semibold text-white mb-4">Institution Comparison</h3>
        <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  const displayData = institutions.slice(0, maxInstitutions).map((inst) => ({
    ...inst,
    color: COLORS[inst.riskLevel as keyof typeof COLORS] || COLORS.LOW,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50"
    >
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Institution Comparison
      </h3>

      {/* Viral Score Comparison Chart */}
      <div className="mb-6">
        <h4 className="text-xs text-slate-400 mb-3 uppercase tracking-wide">Viral Scores</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={displayData}
            margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.3)" />
            <XAxis
              dataKey="institution"
              stroke="#94a3b8"
              fontSize={10}
              tick={{ fill: "#94a3b8" }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tick={{ fill: "#94a3b8" }}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="viralScore"
              name="Viral Score"
              radius={[4, 4, 0, 0]}
            >
              {displayData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Comparison Table */}
      <div className="space-y-2">
        <h4 className="text-xs text-slate-400 mb-3 uppercase tracking-wide">Detailed View</h4>
        <div className="space-y-2">
          {displayData.map((inst, index) => (
            <motion.div
              key={inst.institution}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: inst.color }}
                />
                <span className="text-sm font-medium text-white">{inst.institution}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    inst.riskLevel === "HIGH"
                      ? "bg-red-500/20 text-red-300"
                      : inst.riskLevel === "MEDIUM"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {inst.riskLevel}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <div className="text-slate-400">Viral Score</div>
                  <div className="text-white font-semibold">{inst.viralScore}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400">Trend</div>
                  <div className="flex items-center gap-1">
                    {inst.trendVelocity > 0 ? (
                      <TrendingUp className="w-3 h-3 text-red-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-emerald-400" />
                    )}
                    <span
                      className={`font-semibold ${
                        inst.trendVelocity > 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {inst.trendVelocity > 0 ? "+" : ""}
                      {inst.trendVelocity.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400">Tweets</div>
                  <div className="text-white font-semibold">{inst.tweetCount}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

