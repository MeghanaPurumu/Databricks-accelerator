import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Database,
  Layers,
  ArrowRight,
  RefreshCw,
  Plus,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Clock,
  HardDrive,
  AlertCircle,
  Wifi,
  WifiOff,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  getStoredConnection,
  saveConnection,
  disconnectDatabricks,
  StoredConnection,
  CONNECTION_CHANGED_EVENT,
} from '../../services/connectionStore';
import {
  checkDatabricksConnection,
  fetchCatalogs,
  fetchSchemas,
} from '../../services/databricksApiService';

export interface WorkspaceConnection {
  id: string;
  name: string;
  resourceGroup: string;
  region: string;
  host: string;
  warehouseId?: string;
  connected: boolean;
  catalogsCount: number;
  catalogs: string[];
  isPrimary?: boolean;
}

export default function EstablishedConnections() {
  const navigate = useNavigate();

  // Active Connection State from Store
  const [conn, setConn] = useState<StoredConnection>(() => getStoredConnection());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [catalogs, setCatalogs] = useState<string[]>(['mdm', 'workspace', 'samples', 'system']);
  const [schemas, setSchemas] = useState<string[]>(['gold', 'silver', 'bronze', 'default']);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  // Selected Workspace state
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('ws-primary');

  const loadCatalogsAndSchemas = async (activeHost?: string) => {
    setLoadingMetadata(true);
    try {
      const cats = await fetchCatalogs();
      const validCats = cats && cats.length > 0 ? cats : ['mdm', 'workspace', 'samples', 'system'];
      setCatalogs(validCats);
      const schs = await fetchSchemas(validCats[0] || 'mdm');
      setSchemas(schs && schs.length > 0 ? schs : ['gold', 'silver', 'bronze', 'default']);
    } catch {
      setCatalogs(['mdm', 'workspace', 'samples', 'system']);
      setSchemas(['gold', 'silver', 'bronze', 'default']);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const refreshStatus = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await checkDatabricksConnection();
      const current = getStoredConnection();
      const updated: StoredConnection = {
        ...current,
        connected: res.connected,
        host: res.host || current.host,
        warehouseId: res.warehouse_id || current.warehouseId,
        message: res.message,
      };
      setConn(updated);
      saveConnection(updated);
      setTestResult({
        success: res.connected,
        message: res.connected
          ? `Workspace connection verified successfully! Active host: ${res.host || current.host}`
          : res.message || 'Connection check failed. Please verify credentials.',
      });

      if (res.connected) {
        loadCatalogsAndSchemas(res.host || current.host);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Error communicating with Databricks API.',
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    checkDatabricksConnection()
      .then(res => {
        if (res.connected) {
          const current = getStoredConnection();
          const updated: StoredConnection = {
            ...current,
            connected: true,
            host: res.host || current.host,
            warehouseId: res.warehouse_id || current.warehouseId,
            message: res.message || 'Connected to Databricks',
          };
          if (!current.connected || current.host !== res.host) {
            saveConnection(updated);
          }
          setConn(updated);
          loadCatalogsAndSchemas(updated.host);
        }
      })
      .catch(() => {});

    const handleConnChange = () => {
      const current = getStoredConnection();
      setConn(current);
      if (current.connected) {
        loadCatalogsAndSchemas(current.host);
      }
    };

    window.addEventListener(CONNECTION_CHANGED_EVENT, handleConnChange);
    window.addEventListener('storage', handleConnChange);

    return () => {
      window.removeEventListener(CONNECTION_CHANGED_EVENT, handleConnChange);
      window.removeEventListener('storage', handleConnChange);
    };
  }, []);

  const handleDisconnect = () => {
    if (window.confirm('Are you sure you want to disconnect from this Databricks workspace?')) {
      disconnectDatabricks();
      setConn(getStoredConnection());
      setTestResult(null);
      setCatalogs([]);
      setSchemas([]);
    }
  };

  // Workspace Connections list representing different resource groups / workspaces
  const workspaces: WorkspaceConnection[] = [
    {
      id: 'ws-primary',
      name: 'Primary Databricks Lakehouse',
      resourceGroup: 'rg-mdm-prod-eastus',
      region: 'East US',
      host: conn.host || 'adb-xxxx.azuredatabricks.net',
      warehouseId: conn.warehouseId || undefined,
      connected: conn.connected,
      catalogsCount: catalogs.length,
      catalogs: catalogs,
      isPrimary: true,
    },
    {
      id: 'ws-analytics',
      name: 'Analytics & Consumption Workspace',
      resourceGroup: 'rg-analytics-centralus',
      region: 'Central US',
      host: 'adb-analytics-central.azuredatabricks.net',
      warehouseId: '4b8c9d0e1f2a3b4c',
      connected: true,
      catalogsCount: 3,
      catalogs: ['analytics', 'reporting', 'gold_read'],
      isPrimary: false,
    },
    {
      id: 'ws-staging',
      name: 'Staging & Pipeline Ingestion Lakehouse',
      resourceGroup: 'rg-data-staging-eastus2',
      region: 'East US 2',
      host: 'adb-staging-east2.azuredatabricks.net',
      warehouseId: undefined,
      connected: true,
      catalogsCount: 2,
      catalogs: ['staging_lake', 'raw_ingestion'],
      isPrimary: false,
    },
  ];

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId) || workspaces[0];

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-gray-50 flex flex-col h-full">
      {/* Top Header Banner (Minimal - No Dashboard word) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-gray-100 rounded-2xl p-6 card-shadow">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`flex h-2 w-2 rounded-full ${
                conn.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            ></span>
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">
              Integration & Connectivity Hub
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="text-indigo-600" size={22} />
            Established Connections
          </h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Select a Databricks workspace connection below to inspect its Unity Catalog layers,
            active golden stores, and metadata health.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={refreshStatus}
            disabled={testing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm"
          >
            <RefreshCw size={13} className={testing ? 'animate-spin text-indigo-600' : 'text-gray-500'} />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={() => navigate('/connections')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-sm"
          >
            <Plus size={14} /> Add / Configure Connection
          </button>
        </div>
      </div>

      {/* Test Result Alert */}
      {testResult && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-xs font-semibold ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 size={16} className="text-emerald-600" />
            ) : (
              <AlertCircle size={16} className="text-amber-600" />
            )}
            <span>{testResult.message}</span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-[11px] underline hover:no-underline font-normal text-gray-600 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Workspace Connections Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Server size={14} className="text-indigo-600" />
            Available Workspace Connections ({workspaces.length})
          </h2>
          <span className="text-[11px] text-gray-400">Click a workspace card to view its overview</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {workspaces.map(ws => {
            const isSelected = ws.id === selectedWorkspaceId;
            return (
              <div
                key={ws.id}
                onClick={() => setSelectedWorkspaceId(ws.id)}
                className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between relative ${
                  isSelected
                    ? 'bg-white border-indigo-500 ring-2 ring-indigo-100 shadow-md'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                      {ws.resourceGroup}
                    </span>
                    {ws.connected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Standby
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    {ws.name}
                    {ws.isPrimary && (
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded font-semibold uppercase">
                        Primary
                      </span>
                    )}
                  </h3>
                  <p className="text-xs font-mono text-gray-500 mt-1 truncate">{ws.host}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Region: <strong className="text-gray-700">{ws.region}</strong></span>
                  <span className="font-semibold text-indigo-600">
                    {isSelected ? 'Selected' : 'Click to view'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Workspace Overview Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 card-shadow space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-sm">
              <Server size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">{selectedWorkspace.name}</h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                  {selectedWorkspace.resourceGroup}
                </span>
                {selectedWorkspace.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={11} /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    Disconnected
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Target connection endpoint for Master Data discovery, Delta Lake storage, and golden consolidation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/connections')}
              className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Configure in Connection Page
            </button>
            {selectedWorkspace.connected && selectedWorkspace.isPrimary && (
              <button
                onClick={handleDisconnect}
                className="px-3.5 py-2 rounded-xl border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
              >
                Disconnect
              </button>
            )}
            <button
              onClick={() => navigate('/master-data')}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              Explore MDMs <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Minimal Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Server size={11} className="text-indigo-500" /> Host / Workspace URL
            </span>
            <p className="text-xs font-mono font-semibold text-gray-800 break-all">
              {selectedWorkspace.host}
            </p>
            <span className="text-[10px] text-gray-400">Databricks REST API endpoint</span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound size={11} className="text-amber-500" /> Authentication State
            </span>
            <p className="text-xs font-mono font-semibold text-gray-800">
              {selectedWorkspace.connected ? 'dapi•••••••••••••••• (Encrypted PAT)' : 'Token Not Set'}
            </p>
            <span className="text-[10px] text-gray-400">Personal Access Token secured</span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Database size={11} className="text-purple-500" /> SQL Warehouse ID
            </span>
            <p className="text-xs font-mono font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded inline-block">
              {selectedWorkspace.warehouseId || 'REST Mode (Direct)'}
            </p>
            <span className="text-[10px] text-gray-400">
              {selectedWorkspace.warehouseId ? 'SQL Warehouse live execution' : 'Unity Catalog direct mode'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-100 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={11} className="text-emerald-500" /> Target Golden Store
            </span>
            <p className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block">
              mdm.gold
            </p>
            <span className="text-[10px] text-gray-400">Consolidated Delta Lake Golden Tables</span>
          </div>
        </div>

        {/* Catalogs & Schemas in this Workspace */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive size={13} className="text-indigo-600" />
              Discovered Catalogs & Schemas in {selectedWorkspace.name}
            </h4>
            <span className="text-[11px] text-gray-400">
              {selectedWorkspace.catalogs.length} Catalogs available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {selectedWorkspace.catalogs.map(cat => (
              <div
                key={cat}
                className={`p-3.5 rounded-xl border ${
                  cat === 'mdm'
                    ? 'border-indigo-200 bg-indigo-50/40'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-900 font-mono flex items-center gap-1">
                    <Database size={12} className={cat === 'mdm' ? 'text-indigo-600' : 'text-gray-400'} />
                    {cat}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      cat === 'mdm'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {cat === 'mdm' ? 'Target Catalog' : 'Source Catalog'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  {cat === 'mdm'
                    ? 'Schemas: gold, silver, bronze'
                    : 'Schemas: default, analytics, staging, raw'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
