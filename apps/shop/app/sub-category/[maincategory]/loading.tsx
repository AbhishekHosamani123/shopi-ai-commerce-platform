import React from 'react';

const SubProductCardSkeleton = () => (
  <div className="flex flex-col border border-slate-100 rounded-xl p-3 space-y-3">
    <div className="w-full aspect-square bg-slate-200 rounded-lg" />
    <div className="w-1/3 h-3 bg-slate-200 rounded" />
    <div className="w-3/4 h-4 bg-slate-200 rounded" />
    <div className="w-1/2 h-5 bg-slate-200 rounded" />
  </div>
);

export default function Loading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-pulse">
      <div className="w-48 h-4 bg-slate-200 rounded mb-8" />
      <div className="flex gap-8">
        <div className="hidden lg:flex flex-col gap-6 w-64 shrink-0 p-4 border border-slate-100 rounded-xl">
          <div className="w-32 h-6 bg-slate-200 rounded" />
          <div className="space-y-3">
            <div className="w-20 h-4 bg-slate-200 rounded" />
            <div className="w-full h-8 bg-slate-200 rounded" />
          </div>
          <div className="space-y-3">
            <div className="w-24 h-4 bg-slate-200 rounded" />
            <div className="w-full h-8 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <SubProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
