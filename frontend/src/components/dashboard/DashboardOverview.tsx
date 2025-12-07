"use client";

import { motion } from "framer-motion";
import { Building2, AlertTriangle, TrendingUp, MessageSquare, Activity } from "lucide-react";
import StatCard from "./StatCard";
import RiskDistributionChart from "./RiskDistributionChart";
import { DashboardSkeleton } from "../ui/Skeleton";

interface DashboardOverviewProps {
  totalInstitutions: number;
  activeAlerts: number;
  riskDistribution: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  totalTweetsToday?: number;
  avgViralScore?: number;
  lastAnalysisTime?: Date;
  isLoading?: boolean;
}

export default function DashboardOverview({
  totalInstitutions,
  activeAlerts,
  riskDistribution,
  totalTweetsToday = 0,
  avgViralScore = 0,
  lastAnalysisTime,
  isLoading = false,
}: DashboardOverviewProps) {
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const totalRisk = riskDistribution.HIGH + riskDistribution.MEDIUM + riskDistribution.LOW;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Institutions Monitored"
          value={totalInstitutions}
          subtitle="Total in portfolio"
          icon={Building2}
        />
        <StatCard
          title="Active Alerts"
          value={activeAlerts}
          subtitle={`${riskDistribution.HIGH} HIGH, ${riskDistribution.MEDIUM} MEDIUM`}
          icon={AlertTriangle}
          className={activeAlerts > 0 ? "border-red-500/30 shadow-red-500/10" : ""}
        />
        <StatCard
          title="Tweets Analyzed"
          value={totalTweetsToday.toLocaleString()}
          subtitle="Today"
          icon={MessageSquare}
        />
        <StatCard
          title="Avg Viral Score"
          value={avgViralScore.toFixed(1)}
          subtitle="Engagement-weighted"
          icon={TrendingUp}
          trend={
            avgViralScore > 50
              ? { value: Math.round((avgViralScore - 50) / 50 * 100), isPositive: false }
              : { value: Math.round((50 - avgViralScore) / 50 * 100), isPositive: true }
          }
        />
      </div>

      {/* Risk Distribution Chart */}
      {totalRisk > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RiskDistributionChart data={riskDistribution} />
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50"
          >
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              System Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Last Analysis</span>
                <span className="text-sm text-white font-medium">
                  {lastAnalysisTime
                    ? lastAnalysisTime.toLocaleTimeString()
                    : "Never"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Risk Coverage</span>
                <span className="text-sm text-white font-medium">
                  {totalRisk} institutions analyzed
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Alert Rate</span>
                <span className="text-sm text-white font-medium">
                  {totalRisk > 0
                    ? ((activeAlerts / totalRisk) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

