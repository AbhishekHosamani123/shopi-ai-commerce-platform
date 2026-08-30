import React from 'react';
import Stars from './ProductUi/Stars';

interface FilterSidebarProps {
  dataChecked: boolean;
  filterSubmit: (e: any) => void;
  toggleClear: () => void;
  mobileMode: boolean;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  dataChecked,
  filterSubmit,
  toggleClear,
  mobileMode,
}) => {
  return (
    <div className={`${!mobileMode ? 'hidden lg:flex' : 'flex'} flex-col w-full bg-white ${!mobileMode ? 'border border-slate-200 rounded-2xl p-5 shadow-xs' : 'p-2'}`}>
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm tracking-wide uppercase">Filters</h3>
        <button
          type="button"
          onClick={toggleClear}
          disabled={!dataChecked}
          className="text-xs font-semibold text-[#0D94FB] hover:text-[#012652] transition-colors cursor-pointer disabled:opacity-50"
        >
          Reset All
        </button>
      </div>

      <form onSubmit={filterSubmit} className="flex flex-col gap-6 w-full">
        {/* Price Range */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Price Range (₹)
          </h4>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="pricefrom" className="block mb-1 text-[11px] font-medium text-slate-500">
                Min (₹)
              </label>
              <input
                type="number"
                id="pricefrom"
                name="pricefrom"
                defaultValue={0}
                min="0"
                max="50000"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-[#0D94FB] focus:border-[#0D94FB] outline-none transition-all"
                placeholder="₹0"
                required
              />
            </div>
            <div>
              <label htmlFor="priceto" className="block mb-1 text-[11px] font-medium text-slate-500">
                Max (₹)
              </label>
              <input
                type="number"
                id="priceto"
                name="priceto"
                defaultValue={10000}
                min="1"
                max="50000"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-[#0D94FB] focus:border-[#0D94FB] outline-none transition-all"
                placeholder="₹10,000"
                required
              />
            </div>
          </div>
        </div>

        {/* Rating Filter */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Minimum Rating
          </h4>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((r) => (
              <label
                key={r}
                className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors group"
              >
                <input
                  id={`star-rating-${r}`}
                  type="radio"
                  name="rating"
                  value={r}
                  defaultChecked={r === 1}
                  className="w-4 h-4 text-[#0D94FB] accent-[#0D94FB] border-slate-300 focus:ring-[#0D94FB]"
                />
                <div className="flex items-center gap-1.5">
                  <Stars count={5} size={16} value={r} color2="#ffa500" edit={false} className="flex gap-0.5" />
                  <span className="text-xs text-slate-600 font-medium group-hover:text-slate-900">
                    {r === 5 ? '5 Stars' : `${r} Stars & Up`}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={!dataChecked}
            className="w-full py-2.5 px-4 bg-[#012652] hover:bg-[#0D94FB] text-white text-xs font-semibold rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={toggleClear}
            disabled={!dataChecked}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            Clear All
          </button>
        </div>
      </form>
    </div>
  );
};

export default FilterSidebar;