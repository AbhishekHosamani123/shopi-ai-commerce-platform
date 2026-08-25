import React from 'react';

export default function ProductLoadingSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="w-48 h-4 bg-slate-200 rounded mb-8" />

      {/* Main product shell */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Image Gallery Skeleton */}
        <div className="flex flex-col gap-4 items-center">
          <div className="w-full max-w-[540px] aspect-square bg-slate-200 rounded-2xl" />
          <div className="flex gap-3 justify-center">
            <div className="w-16 h-16 bg-slate-200 rounded-lg" />
            <div className="w-16 h-16 bg-slate-200 rounded-lg" />
            <div className="w-16 h-16 bg-slate-200 rounded-lg" />
          </div>
        </div>

        {/* Product Info Skeleton */}
        <div className="flex flex-col gap-6 p-6 border border-slate-100 rounded-2xl">
          {/* Title & Brand */}
          <div className="space-y-3">
            <div className="w-3/4 h-8 bg-slate-200 rounded-md" />
            <div className="w-1/3 h-4 bg-slate-200 rounded" />
            <div className="w-1/4 h-4 bg-slate-200 rounded" />
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-4 py-4 border-y border-slate-100">
            <div className="w-32 h-10 bg-slate-200 rounded-md" />
            <div className="w-20 h-6 bg-slate-200 rounded" />
          </div>

          {/* Color & Size Options */}
          <div className="space-y-4">
            <div className="w-24 h-4 bg-slate-200 rounded" />
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-200" />
              <div className="w-8 h-8 rounded-full bg-slate-200" />
              <div className="w-8 h-8 rounded-full bg-slate-200" />
            </div>

            <div className="w-20 h-4 bg-slate-200 rounded mt-4" />
            <div className="flex gap-2">
              <div className="w-12 h-10 rounded-lg bg-slate-200" />
              <div className="w-12 h-10 rounded-lg bg-slate-200" />
              <div className="w-12 h-10 rounded-lg bg-slate-200" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <div className="w-48 h-12 bg-slate-200 rounded-xl" />
            <div className="w-48 h-12 bg-slate-200 rounded-xl" />
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-100">
            <div className="h-16 bg-slate-200 rounded-xl" />
            <div className="h-16 bg-slate-200 rounded-xl" />
            <div className="h-16 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
