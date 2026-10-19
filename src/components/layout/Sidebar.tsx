import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MASTER_DEFINITIONS, MasterDefinition, mergeAndDeduplicateMdms, getCleanCustomMdms } from '../../types/mdmMaster';
import { getLocalStorageData } from '../../services/masterDataService';
import { getStoredConnection, CONNECTION_CHANGED_EVENT } from '../../services/connectionStore';
import {
  LayoutDashboard,
  Database,
  Users,
  Package,
  Truck,
  MapPin,
  ClipboardList,
  Award,
  ShieldCheck,
  Network,
  Sliders,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Settings,
  Zap,
  Activity,
  Table2,
  Play,
  Wifi,
  WifiOff,
  UserCheck,
  Building2,
  Server,
  Link2,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Users,
  Package,
  Truck,
  UserCheck,
  Building: Building2,
  Building2,
  MapPin,
  Database,
  Award,
};

function getMdmIcon(iconName?: string) {
  return ICON_MAP[iconName || ''] || Award;
}

interface RegisteredTable {
  sourceId: string;
  tableName: string;
  catalog?: string;
  schema?: string;
  label: string;
}

function loadSourcesForMdm(mdm: MasterDefinition): RegisteredTable[] {
  const all = getLocalStorageData<any[]>('lf_source_systems', []);
  const targetId = (mdm.id || '').toLowerCase();
  const domainKey = (mdm.domain || '').toLowerCase();
  const targetTableKey = (mdm.targetTable || '').toLowerCase();

  return all
    .filter(s => {
      const sMdmId = String(s.targetMdmId || '').toLowerCase();
      const sTable = String(s.targetTable || '').toLowerCase();
      const sDomain = String(s.domain || '').toLowerCase();
      if (sMdmId && sMdmId === targetId) return true;
      if (sTable && targetTableKey && sTable === targetTableKey) return true;
      if (sDomain && sDomain === domainKey) return true;
      return false;
    })
    .map(s => ({
      sourceId: s.sourceId || s.id,
      tableName: s.tableName || s.name || 'table',
      catalog: s.catalog,
      schema: s.schema,
      label: s.tableName || s.sourceName || s.name || 'table',
    }));
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    masterData: true,
    stewardship: true,
    quality: false,
  });
  const [expandedMdms, setExpandedMdms] = useState<Record<string, boolean>>({});
  const [sourcesByMdm, setSourcesByMdm] = useState<Record<string, RegisteredTable[]>>({});
  const [connected, setConnected] = useState(() => getStoredConnection().connected);

  const toggleMenu = (menuKey: string) => {
    setOpenMenus(prev => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (paths: string[]) => paths.some(p => location.pathname.startsWith(p));

  const refreshSources = useCallback(() => {
    const custom = getCleanCustomMdms();
    const all = mergeAndDeduplicateMdms(MASTER_DEFINITIONS, custom);
    const map: Record<string, RegisteredTable[]> = {};
    all.forEach(mdm => {
      map[mdm.id] = loadSourcesForMdm(mdm);
    });
    setSourcesByMdm(map);
  }, []);

  const [customMdms, setCustomMdms] = useState<MasterDefinition[]>(() => getCleanCustomMdms());

  useEffect(() => {
    refreshSources();
    const handleMdmChange = () => {
      setCustomMdms(getCleanCustomMdms());
      refreshSources();
    };
    const handleConn = () => setConnected(getStoredConnection().connected);

    window.addEventListener('mdm_definitions_changed', handleMdmChange);
    window.addEventListener('lf_sources_changed', handleMdmChange);
    window.addEventListener('storage', handleMdmChange);
    window.addEventListener(CONNECTION_CHANGED_EVENT, handleConn);
    return () => {
      window.removeEventListener('mdm_definitions_changed', handleMdmChange);
      window.removeEventListener('lf_sources_changed', handleMdmChange);
      window.removeEventListener('storage', handleMdmChange);
      window.removeEventListener(CONNECTION_CHANGED_EVENT, handleConn);
    };
  }, [refreshSources]);

  const allMdms: MasterDefinition[] = useMemo(() => {
    return mergeAndDeduplicateMdms(MASTER_DEFINITIONS, customMdms);
  }, [customMdms]);

  const NavLink = ({ to, label, Icon, indent = false }: { to: string; label: string; Icon: any; indent?: boolean }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        className={`flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-all duration-150 group
          ${indent ? 'ml-3 pl-3' : ''}
          ${active
            ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
      >
        <Icon
          size={indent ? 14 : 15}
          className={active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}
        />
        <span className="truncate">{label}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0"></span>}
      </Link>
    );
  };

  const CategoryHeader = ({
    label, menuKey, Icon, paths
  }: { label: string; menuKey: string; Icon: any; paths: string[] }) => {
    const isOpen = openMenus[menuKey];
    const parentActive = isParentActive(paths);
    return (
      <button
        onClick={() => toggleMenu(menuKey)}
        className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150
          ${parentActive ? 'text-indigo-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon size={15} className={parentActive ? 'text-indigo-500' : 'text-gray-400'} />
          <span>{label}</span>
        </div>
        {isOpen
          ? <ChevronDown size={13} className="text-gray-400" />
          : <ChevronRight size={13} className="text-gray-400" />}
      </button>
    );
  };

  const toggleMdmExpand = (mdmId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedMdms(prev => ({ ...prev, [mdmId]: !prev[mdmId] }));
  };

  const runPipelineForMdm = (mdmId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/master-data/${mdmId}/golden-records?run=1`);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen overflow-y-auto shrink-0" style={{ boxShadow: '1px 0 0 #f0f2f8' }}>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)' }}>
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-none">MDM</h1>
            <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wide">MDM Platform</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <NavLink to="/" label="Established Connections" Icon={Server} />
        <NavLink to="/connections" label="Connection & Ingestion" Icon={Link2} />

        <div className="pt-3 pb-1">
          <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Core Data</span>
        </div>

        <div className="space-y-0.5">
          <CategoryHeader label="Master Data" menuKey="masterData" Icon={Database} paths={['/master-data']} />
          {openMenus.masterData && (
            <div className="space-y-0.5 mt-0.5">
              <NavLink to="/master-data" label="Master Data Hub" Icon={Database} indent />
              {allMdms.map(mdm => {
                const tables = sourcesByMdm[mdm.id] || [];
                const expanded = expandedMdms[mdm.id] ?? tables.length > 0;
                const Icon = getMdmIcon(mdm.iconName);
                const goldenPath = `/master-data/${mdm.id}/golden-records`;
                const active = location.pathname.startsWith(goldenPath) || location.pathname.includes(`/${mdm.id}/`);

                return (
                  <div key={mdm.id} className="ml-3">
                    <div
                      className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[12px] transition group
                        ${active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleMdmExpand(mdm.id, e)}
                        className="p-0.5 text-gray-400 hover:text-gray-600"
                        title={expanded ? 'Collapse tables' : 'Expand tables'}
                      >
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <Link to={goldenPath} className="flex items-center gap-2 flex-1 min-w-0">
                        <Icon size={13} className={active ? 'text-indigo-600' : 'text-gray-400'} />
                        <span className="truncate">{mdm.name}</span>
                        {tables.length > 0 && (
                          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 shrink-0">
                            {tables.length}
                          </span>
                        )}
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => runPipelineForMdm(mdm.id, e)}
                        className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition"
                        title="Run pipeline & view golden records"
                      >
                        <Play size={11} />
                      </button>
                    </div>

                    {expanded && (
                      <div className="ml-5 mt-0.5 space-y-0.5 border-l border-gray-100 pl-2">
                        {tables.length === 0 ? (
                          <p className="px-2 py-1 text-[10px] text-gray-400 italic">No tables registered</p>
                        ) : (
                          tables.map(t => (
                            <Link
                              key={t.sourceId}
                              to={goldenPath}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-gray-500 hover:text-indigo-700 hover:bg-indigo-50/60 transition truncate"
                              title={`${t.catalog || ''}.${t.schema || ''}.${t.tableName}`}
                            >
                              <Table2 size={11} className="text-gray-400 shrink-0" />
                              <span className="truncate">{t.label}</span>
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-3 pb-1">
          <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Governance</span>
        </div>

        <div className="space-y-0.5">
          <CategoryHeader label="Stewardship" menuKey="stewardship" Icon={ClipboardList} paths={['/stewardship']} />
          {openMenus.stewardship && (
            <div className="space-y-0.5 mt-0.5">
              <NavLink to="/stewardship/queue" label="Review Queue" Icon={ClipboardList} indent />
            </div>
          )}
        </div>

        <div className="space-y-0.5">
          <CategoryHeader label="Data Quality" menuKey="quality" Icon={ShieldCheck} paths={['/quality']} />
          {openMenus.quality && (
            <div className="space-y-0.5 mt-0.5">
              <NavLink to="/quality/dashboard" label="Quality Dashboard" Icon={Activity} indent />
              <NavLink to="/quality/rules" label="Rules Engine" Icon={Sliders} indent />
              <NavLink to="/quality/exceptions" label="Exceptions" Icon={AlertTriangle} indent />
            </div>
          )}
        </div>

        <NavLink to="/lineage" label="Data Lineage" Icon={Network} />

        <div className="pt-3 pb-1">
          <span className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">System</span>
        </div>

        <NavLink to="/settings" label="Settings" Icon={Settings} />
      </nav>

      {/* Connection + User footer */}
      <div className="p-3 border-t border-gray-100 space-y-2">
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold ${
          connected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'
        }`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? 'Connected to Databricks' : 'Databricks offline'}
        </div>
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition">
          <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)' }}>
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-gray-800 truncate">Jane Doe</p>
            <p className="text-[10px] text-gray-400 truncate">Senior Data Steward</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
