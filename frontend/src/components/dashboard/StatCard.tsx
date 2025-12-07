"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className = "",
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      className={`rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50 hover:shadow-2xl hover:shadow-slate-900/70 transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</p>
        {Icon && (
          <div className="p-2 rounded-lg bg-slate-700/50">
            <Icon className="w-4 h-4 text-slate-300" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        {trend && (
          <span
            className={`text-sm font-semibold ${
              trend.isPositive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
    </motion.div>
  );
}

