"use client";

import { useState, useMemo } from "react";
import { Search, Filter, ArrowUpDown, X, Building2, TrendingUp, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface Institution {
  name: string;
  category: string;
  riskLevel?: string;
  viralScore?: number;
}

interface EnhancedSidebarProps {
  institutions: Record<string, string[]>;
  selectedInstitutions: string[];
  onToggleInstitution: (institution: string) => void;
  onSelectCategory: (category: string) => void;
  liveResults: Record<string, any>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: "name" | "risk" | "viralScore";
  onSortChange: (sort: "name" | "risk" | "viralScore") => void;
  categoryFilter: string | null;
  onCategoryFilterChange: (category: string | null) => void;
}

export default function EnhancedSidebar({
  institutions,
  selectedInstitutions,
  onToggleInstitution,
  onSelectCategory,
  liveResults,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  categoryFilter,
  onCategoryFilterChange,
}: EnhancedSidebarProps) {
  const [showFilters, setShowFilters] = useState(false);

  // Flatten and filter institutions
  const allInstitutions = useMemo(() => {
    const flat: Institution[] = [];
    Object.entries(institutions).forEach(([category, insts]) => {
      insts.forEach((name) => {
        const analysis = liveResults[name.toLowerCase()];
        flat.push({
          name,
          category,
          riskLevel: analysis?.risk_level,
          viralScore: analysis?.viral_score,
        });
      });
    });

    // Apply search filter
    let filtered = flat;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = flat.filter((inst) => inst.name.toLowerCase().includes(query));
    }

    // Apply category filter
    if (categoryFilter) {
      filtered = filtered.filter((inst) => inst.category === categoryFilter);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "risk":
          const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1, undefined: 0 };
          return (riskOrder[b.riskLevel as keyof typeof riskOrder] || 0) -
                 (riskOrder[a.riskLevel as keyof typeof riskOrder] || 0);
        case "viralScore":
          return (b.viralScore || 0) - (a.viralScore || 0);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return sorted;
  }, [institutions, liveResults, searchQuery, categoryFilter, sortBy]);

  // Calculate category stats
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; selected: number; high: number; medium: number }> = {};
    Object.entries(institutions).forEach(([category, insts]) => {
      const selected = insts.filter((name) => selectedInstitutions.includes(name)).length;
      const high = insts.filter((name) => liveResults[name.toLowerCase()]?.risk_level === "HIGH").length;
      const medium = insts.filter((name) => liveResults[name.toLowerCase()]?.risk_level === "MEDIUM").length;
      stats[category] = {
        total: insts.length,
        selected,
        high,
        medium,
      };
    });
    return stats;
  }, [institutions, selectedInstitutions, liveResults]);

  const getRiskColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case "HIGH":
        return "text-red-400";
      case "MEDIUM":
        return "text-amber-400";
      case "LOW":
        return "text-emerald-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">My Portfolio</h2>
          <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
            {selectedInstitutions.length} selected
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search institutions..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span>Filters & Sort</span>
          </div>
          <motion.div
            animate={{ rotate: showFilters ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ArrowUpDown className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-b border-slate-700 bg-slate-800/30 overflow-hidden"
        >
          <div className="p-4 space-y-4">
            {/* Sort By */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Sort By</label>
              <div className="flex gap-2">
                {(["name", "risk", "viralScore"] as const).map((sort) => (
                  <button
                    key={sort}
                    onClick={() => onSortChange(sort)}
                    className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      sortBy === sort
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {sort === "name" ? "Name" : sort === "risk" ? "Risk" : "Score"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Category</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onCategoryFilterChange(null)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    categoryFilter === null
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  All
                </button>
                {Object.keys(institutions).map((category) => (
                  <button
                    key={category}
                    onClick={() => onCategoryFilterChange(category)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      categoryFilter === category
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Institution List */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Category Stats Summary */}
        {!categoryFilter && (
          <div className="mb-4 space-y-2">
            {Object.entries(categoryStats).map(([category, stats]) => (
              <div
                key={category}
                className="p-2 bg-slate-700/30 rounded-lg text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-300 font-medium">{category}</span>
                  <span className="text-slate-400">{stats.selected}/{stats.total}</span>
                </div>
                {(stats.high > 0 || stats.medium > 0) && (
                  <div className="flex gap-2 mt-1">
                    {stats.high > 0 && (
                      <span className="text-red-400">⚠ {stats.high} HIGH</span>
                    )}
                    {stats.medium > 0 && (
                      <span className="text-amber-400">⚠ {stats.medium} MEDIUM</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Institutions */}
        <div className="space-y-2">
          {allInstitutions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No institutions found</p>
            </div>
          ) : (
            allInstitutions.map((inst) => {
              const isSelected = selectedInstitutions.includes(inst.name);
              return (
                <motion.div
                  key={inst.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-blue-600/20 border-blue-500/50"
                      : "bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50"
                  }`}
                  onClick={() => onToggleInstitution(inst.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {inst.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">{inst.category}</span>
                          {inst.riskLevel && (
                            <span className={`text-xs font-semibold ${getRiskColor(inst.riskLevel)}`}>
                              {inst.riskLevel}
                            </span>
                          )}
                          {inst.viralScore !== undefined && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {inst.viralScore.toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-slate-700 space-y-2">
        <button
          onClick={() => {
            const all = allInstitutions.map((i) => i.name);
            all.forEach((name) => {
              if (!selectedInstitutions.includes(name)) {
                onToggleInstitution(name);
              }
            });
          }}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          Select All Visible
        </button>
        <button
          onClick={() => {
            selectedInstitutions.forEach((name) => onToggleInstitution(name));
          }}
          className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
        >
          Deselect All
        </button>
      </div>
    </div>
  );
}

