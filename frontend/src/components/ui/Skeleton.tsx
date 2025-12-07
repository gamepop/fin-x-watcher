"use client";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className = "", variant = "rectangular" }: SkeletonProps) {
  const baseClasses = "animate-pulse bg-slate-700/50";
  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  return <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />;
}

export function RiskCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-6 shadow-xl shadow-slate-900/50">
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" className="w-32 h-6" />
        <Skeleton variant="circular" className="w-16 h-6" />
      </div>
      <Skeleton variant="text" className="w-full h-4 mb-2" />
      <Skeleton variant="text" className="w-3/4 h-4 mb-4" />
      <div className="flex gap-3 mb-4">
        <Skeleton variant="rectangular" className="w-20 h-8" />
        <Skeleton variant="rectangular" className="w-20 h-8" />
        <Skeleton variant="rectangular" className="w-20 h-8" />
      </div>
      <Skeleton variant="text" className="w-full h-3 mb-1" />
      <Skeleton variant="text" className="w-2/3 h-3" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm p-4">
          <Skeleton variant="text" className="w-24 h-4 mb-2" />
          <Skeleton variant="text" className="w-16 h-8 mb-2" />
          <Skeleton variant="text" className="w-32 h-3" />
        </div>
      ))}
    </div>
  );
}

