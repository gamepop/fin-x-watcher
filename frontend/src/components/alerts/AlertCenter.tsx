"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, X, Filter, CheckCircle2, Circle } from "lucide-react";

interface Alert {
  id: string;
  institution: string;
  riskLevel: "HIGH" | "MEDIUM";
  message: string;
  timestamp: Date;
  read: boolean;
  details?: {
    viralScore: number;
    tweetCount: number;
    keyFindings: string[];
  };
}

interface AlertCenterProps {
  alerts: Alert[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  filterRisk?: "HIGH" | "MEDIUM" | "ALL";
  onFilterChange?: (filter: "HIGH" | "MEDIUM" | "ALL") => void;
}

export default function AlertCenter({
  alerts,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  filterRisk = "ALL",
  onFilterChange,
}: AlertCenterProps) {
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    if (filterRisk === "ALL") return alerts;
    return alerts.filter((alert) => alert.riskLevel === filterRisk);
  }, [alerts, filterRisk]);

  const unreadCount = useMemo(() => {
    return alerts.filter((a) => !a.read).length;
  }, [alerts]);

  const highAlerts = useMemo(() => {
    return alerts.filter((a) => a.riskLevel === "HIGH" && !a.read).length;
  }, [alerts]);

  const mediumAlerts = useMemo(() => {
    return alerts.filter((a) => a.riskLevel === "MEDIUM" && !a.read).length;
  }, [alerts]);

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50">
        <div className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
          <p className="text-slate-300 font-medium">All Clear!</p>
          <p className="text-sm text-slate-500 mt-2">No active alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Alert Center</h3>
            <p className="text-xs text-slate-400">
              {highAlerts} HIGH, {mediumAlerts} MEDIUM unread
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {onFilterChange && (
            <div className="flex gap-1 bg-slate-700/50 rounded-lg p-1">
              {(["ALL", "HIGH", "MEDIUM"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => onFilterChange(filter)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    filterRisk === filter
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors"
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No alerts match the current filter</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 rounded-lg border transition-all ${
                alert.read
                  ? "bg-slate-700/20 border-slate-600/30 opacity-75"
                  : alert.riskLevel === "HIGH"
                  ? "bg-red-950/20 border-red-500/30 ring-1 ring-red-500/20"
                  : "bg-amber-950/20 border-amber-500/30"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <button
                    onClick={() => {
                      onMarkRead(alert.id);
                    }}
                    className="mt-0.5 transition-colors hover:opacity-80"
                    title={alert.read ? "Mark as unread" : "Mark as read"}
                  >
                    {alert.read ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-blue-400" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-white">{alert.institution}</h4>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          alert.riskLevel === "HIGH"
                            ? "bg-red-500/20 text-red-400 border border-red-500/50"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                        }`}
                      >
                        {alert.riskLevel}
                      </span>
                      {!alert.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      )}
                    </div>
                    <p className="text-sm text-slate-300 mb-2">{alert.message}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>{alert.timestamp.toLocaleString()}</span>
                      {alert.details && (
                        <>
                          <span>Score: {alert.details.viralScore}</span>
                          <span>Tweets: {alert.details.tweetCount}</span>
                        </>
                      )}
                    </div>
                    {alert.details && alert.details.keyFindings && alert.details.keyFindings.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedAlert(expandedAlert === alert.id ? null : alert.id)
                        }
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                      >
                        {expandedAlert === alert.id ? "Hide" : "Show"} Details
                      </button>
                    )}
                    {expandedAlert === alert.id && alert.details && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-slate-600"
                      >
                        <h5 className="text-xs font-semibold text-slate-300 mb-2">Key Findings:</h5>
                        <ul className="space-y-1">
                          {alert.details.keyFindings.map((finding, idx) => (
                            <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                              <span className="text-blue-400 mt-0.5">•</span>
                              <span>{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

