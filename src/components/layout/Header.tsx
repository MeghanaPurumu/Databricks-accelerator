import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, ChevronRight, HelpCircle } from 'lucide-react';

export default function Header() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  const getBreadcrumbs = () => {
    if (pathnames.length === 0) return [{ label: 'Established Connections', active: true }];
    return [
      { label: 'Home', active: false },
      ...pathnames.map((val, i) => ({
        label: val.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        active: i === pathnames.length - 1
      }))
    ];
  };

  const crumbs = getBreadcrumbs();

  return (
    <header className="h-14 bg-white border-b border-gray-100 px-6 flex items-center justify-between shrink-0 z-10"
      style={{ boxShadow: '0 1px 0 #f0f2f8' }}>
      {/* Breadcrumbs / Page title */}
      <div className="flex items-center gap-2">
        {pathnames.length === 0 ? (
          <span className="text-[13px] font-semibold text-gray-900">Established Connections</span>
        ) : (
          crumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
              <span className={`text-[13px] font-${crumb.active ? 'semibold text-gray-900' : 'medium text-gray-400'}`}>
                {crumb.label}
              </span>
            </React.Fragment>
          ))
        )}
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={13} className="text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Search records..."
            className="w-56 text-[13px] bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-lg py-1.5 pl-8 pr-4 text-gray-700 placeholder-gray-400 outline-none transition-all"
          />
        </div>

        {/* Help */}
        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
          <HelpCircle size={16} />
        </button>

        {/* Notifications */}
        <button className="relative h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-indigo-500 rounded-full ring-1 ring-white"></span>
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200"></div>

        {/* Workspace pill */}
        <div className="flex items-center gap-2 pl-1">
          <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)' }}>
            JD
          </div>
          <div className="hidden sm:block">
            <p className="text-[12px] font-semibold text-gray-800 leading-none">Jane Doe</p>
            <p className="text-[10px] text-gray-400">lake_fusion_prod</p>
          </div>
        </div>
      </div>
    </header>
  );
}
