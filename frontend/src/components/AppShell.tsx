import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  CircleAlert,
  LayoutDashboard,
  Layers,
  Menu,
  TrendingDown,
  X,
} from 'lucide-react';
import { useMeta } from '../context/MetaContext';
import { formatDateShort } from '../lib/format';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Operations' },
  { to: '/wells', label: 'Wells', icon: Layers, group: 'Operations' },
  { to: '/production', label: 'Production', icon: BarChart3, group: 'Operations' },
  { to: '/downtime', label: 'Downtime', icon: CircleAlert, group: 'Operations' },
  { to: '/forecast', label: 'Forecasts', icon: TrendingDown, group: 'Planning' },
];

const pageLabels: Record<string, string> = {
  dashboard: 'Overview',
  wells: 'Wells',
  production: 'Production',
  downtime: 'Downtime',
  forecast: 'Forecasts',
};

function BrandMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" className="brand-mark" aria-hidden="true">
      <defs>
        <linearGradient id="brand-gradient" x1="0" y1="0" x2="34" y2="34">
          <stop stopColor="#f6c266" />
          <stop offset="1" stopColor="#e08a20" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="9" fill="url(#brand-gradient)" />
      <path
        d="M8.5 24 17 8.8 25.5 24"
        fill="none"
        stroke="#0a1016"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13 24h8M15.5 19h3" stroke="#0a1016" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AppShell() {
  const location = useLocation();
  const { meta } = useMeta();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const segment = location.pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  const activeNav = navigation.find((item) => item.to === `/${segment}`);
  const sectionLabel = activeNav?.group ?? 'Operations';
  const pageLabel = pageLabels[segment] ?? 'Well detail';
  const activeWells = meta?.statusCounts?.PRODUCING;
  const totalWells = meta ? Object.values(meta.statusCounts ?? {}).reduce((sum, count) => sum + count, 0) : undefined;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head">
          <NavLink to="/dashboard" className="brand">
            <BrandMark />
            <span className="brand-text">
              <span className="brand-name">MERIDIAN</span>
              <span className="brand-sub">Production management</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={17} />
          </button>
        </div>

        <div className="asset-card">
          <div className="asset-card-top">
            <span className="asset-kicker">Active asset</span>
            <span className="live-dot" />
          </div>
          <strong>Field Operations</strong>
          <span className="asset-meta">
            {meta?.fields.length ?? 4} fields
            {activeWells !== undefined && totalWells !== undefined
              ? ` · ${activeWells} of ${totalWells} producing`
              : ' · oil & gas'}
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {['Operations', 'Planning'].map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-group-label">{group}</p>
              {navigation
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
                    >
                      <Icon size={17} strokeWidth={1.9} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-data">
            <span className="data-status-dot" />
            <div>
              <span>Production data</span>
              <strong>
                {meta?.latestProductionDate ? `Through ${formatDateShort(meta.latestProductionDate)}` : 'Connected to H2'}
              </strong>
            </div>
          </div>
          <div className="sidebar-version">
            <span>Meridian OS</span>
            <span>v1.0.0</span>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      )}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumb">
              <span>{sectionLabel}</span>
              <span className="breadcrumb-sep">/</span>
              <strong>{pageLabel}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className="live-pill">
              <span className="live-dot" />
              Live
            </span>
            <span className="date-pill">
              <CalendarDays size={14} />
              Data through {formatDateShort(meta?.latestProductionDate)}
            </span>
            <span className="topbar-avatar" title="Field operations">
              OP
            </span>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
