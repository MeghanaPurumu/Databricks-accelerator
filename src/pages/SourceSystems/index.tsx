import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  ChevronRight,
  Database,
  Info,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Square,
  Wifi,
  WifiOff,
  X,
  Eye,
  Play,
  Trash2,
  RotateCcw,
  Users,
  Package,
  Truck,
  UserCheck,
  Check,
  ShieldCheck,
  Pencil,
} from 'lucide-react';

import { AvailableTable, SourceSystem } from '../../types';
import { MASTER_DEFINITIONS, MasterDefinition, CanonicalAttribute } from '../../types/mdmMaster';
import {
  mockSourceSystemService,
} from '../../services/sourceSystemService';
import { rollbackPipelineRun } from '../../services/masterDataService';
import {
  checkDatabricksConnection,
  fetchCatalogs,
  fetchColumns,
  fetchSchemas,
  fetchTables,
  fetchTableCount,
  registerSourceSystems,
  fetchMdmTargets,
  ensureMasterTableExists,
  createCustomMdmTarget,
  DatabricksConnectionStatus,
  DatabricksTable,
  MdmTargetResponse,
} from '../../services/databricksApiService';

import AddSourceSystem from './AddSourceSystem';
import SchemaMapping from './SchemaMapping';
import ProcessingStatus from './ProcessingStatus';
import SourceDetails from './SourceDetails';

// ─── View type ───────────────────────────────────────────────────────────────
type View = 'list' | 'mapping' | 'processing';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, string> = {
    active:     'bg-emerald-50 text-emerald-700 border border-emerald-100',
    inactive:   'bg-gray-100 text-gray-500 border border-gray-200',
    processing: 'bg-blue-50 text-blue-700 border border-blue-100',
    error:      'bg-red-50 text-red-600 border border-red-100',
  };
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg[status] ?? cfg.inactive}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Database size={28} className="text-gray-200 mb-3" />
    <p className="text-[13px] text-gray-400 font-medium">{message}</p>
  </div>
);

/** Filter out internal system tables and MDM outputs from business source discovery */
const isInternalMdmTable = (tableName: string): boolean => {
  if (!tableName) return false;
  const name = tableName.toLowerCase();
  const internalPrefixes = ['audit_', 'mdm_', 'deployment_', '_mdm_', 'system_'];
  const internalKeywords = ['watermark', 'golden_records', 'review_decisions', 'mdm_final', 'mdm_temp', 'mdm_actions'];

  if (internalPrefixes.some(p => name.startsWith(p))) return true;
  if (internalKeywords.some(k => name.includes(k))) return true;
  return false;
};

// ─── Target Master Selection Component ─────────────────────────────────────────
function MasterSelectionBanner({
  selectedMaster,
  masterDefinitions,
  onSelectMaster,
}: {
  selectedMaster: MasterDefinition;
  masterDefinitions: MasterDefinition[];
  onSelectMaster: (master: MasterDefinition) => void;
}) {
  const getIcon = (name: string) => {
    switch (name) {
      case 'Users': return <Users size={16} />;
      case 'Package': return <Package size={16} />;
      case 'Truck': return <Truck size={16} />;
      case 'UserCheck': return <UserCheck size={16} />;
      default: return <Users size={16} />;
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 card-shadow space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
            1
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">Step 1: Select Target Master Definition</h3>
            <p className="text-[11px] text-gray-500">The selected master defines canonical attributes available for source mapping.</p>
          </div>
        </div>
        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1.5">
          <ShieldCheck size={13} />
          Active Target: {selectedMaster.name}
        </span>
      </div>

      {/* Grid of Master Definitions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {masterDefinitions.map(m => {
          const isSelected = m.id === selectedMaster.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMaster(m)}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-100 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}>
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {getIcon(m.iconName)}
                </div>
                {isSelected && (
                  <span className="h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <p className={`text-[13px] font-bold ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                {m.name}
              </p>
              <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5 leading-tight">
                {m.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected Master Canonical Attributes Display */}
      <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
          <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">
            {selectedMaster.name} Canonical Attributes ({selectedMaster.canonicalAttributes.length}):
          </span>
          <div className="flex items-center gap-2">
            {selectedMaster.status && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                selectedMaster.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : selectedMaster.status === 'processing'
                  ? 'bg-blue-50 text-blue-700 border-blue-100'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}>
                {selectedMaster.status.charAt(0).toUpperCase() + selectedMaster.status.slice(1)}
              </span>
            )}
            <span className="text-gray-400 font-mono text-[10px]">
              Target: {selectedMaster.fullTarget || `${selectedMaster.targetCatalog}.${selectedMaster.targetSchema}.${selectedMaster.targetTable}`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {selectedMaster.canonicalAttributes.map(attr => (
            <span
              key={attr.key}
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-md ${
                attr.required
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}>
              {attr.name} <span className="text-gray-400 font-normal">({attr.key})</span>{attr.required ? ' *' : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Rename Columns Modal ─────────────────────────────────────────────────────
function RenameColumnsModal({
  source,
  onClose,
  onSave,
}: {
  source: SourceSystem;
  onClose: () => void;
  onSave: (src: SourceSystem, renames: Record<string, string>) => void;
}) {
  const columns = useMemo(() => {
    if (source.columnMappings && source.columnMappings.length > 0) {
      return source.columnMappings.map(m => m.sourceColumn);
    }
    return [];
  }, [source]);

  const [renames, setRenames] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    columns.forEach(c => { init[c] = (source as any).columnAliases?.[c] ?? c; });
    return init;
  });

  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => columns.filter(c => c.toLowerCase().includes(search.toLowerCase()) ||
      renames[c]?.toLowerCase().includes(search.toLowerCase())),
    [columns, search, renames]
  );

  const hasChanges = columns.some(c => renames[c] !== c);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">Rename Columns</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              <span className="font-semibold text-indigo-600">{source.sourceName}</span>
              {' · '}{columns.length} column{columns.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-50">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter columns…"
              className="w-full text-[12px] bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-lg py-1.5 pl-8 pr-3 outline-none transition"
            />
          </div>
        </div>

        {/* Column list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-[12px] text-gray-400 text-center py-6">No columns found.</p>
          ) : (
            filtered.map(col => {
              const alias = renames[col] ?? col;
              const isChanged = alias !== col;
              return (
                <div key={col} className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                  isChanged ? 'border-indigo-200 bg-indigo-50/40' : 'border-gray-100 bg-gray-50'
                }`}>
                  {/* Original name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium mb-0.5">Original</p>
                    <code className="text-[11px] font-mono text-gray-700 truncate block">{col}</code>
                  </div>
                  <ArrowRight size={12} className={isChanged ? 'text-indigo-400 shrink-0' : 'text-gray-300 shrink-0'} />
                  {/* Editable alias */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-indigo-600 font-medium mb-0.5">Display Name</p>
                    <input
                      value={alias}
                      onChange={e => setRenames(prev => ({ ...prev, [col]: e.target.value }))}
                      className="w-full text-[11px] font-mono bg-white border border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 rounded-md px-2 py-1 outline-none transition"
                      placeholder={col}
                    />
                  </div>
                  {isChanged && (
                    <button
                      onClick={() => setRenames(prev => ({ ...prev, [col]: col }))}
                      title="Reset"
                      className="h-6 w-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="text-[11px] text-gray-400">
            {hasChanges ? (
              <span className="text-indigo-600 font-semibold">
                {columns.filter(c => renames[c] !== c).length} column{columns.filter(c => renames[c] !== c).length !== 1 ? 's' : ''} renamed
              </span>
            ) : 'No changes yet'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(source, renames)}
              className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white transition"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)' }}
            >
              Save Renames
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create Custom Master Target Modal ─────────────────────────────────────────
function CreateTargetModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (targetData: { name: string; domain: string; description: string; targetTable: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const domKey = (domain.trim() || name.trim()).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const tblName = `mdm_gold_master_${domKey}s`;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        domain: domKey,
        description: description.trim() || `Master Data Catalog for ${name.trim()}`,
        targetTable: tblName,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
              +
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-gray-900">Create Custom Master Target</h3>
              <p className="text-[11px] text-gray-400">Define a new Master Domain & Delta Table in Databricks</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition text-sm font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-gray-700 block uppercase tracking-wide mb-1">Master Target Name *</label>
            <input
              required
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (!domain) setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
              }}
              placeholder="e.g. Location MDM, Asset MDM, Order MDM"
              className="w-full text-[13px] bg-gray-50 border border-gray-200 focus:border-indigo-400 rounded-lg p-2.5 outline-none transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-700 block uppercase tracking-wide mb-1">Domain Key *</label>
            <input
              required
              value={domain}
              onChange={e => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="e.g. location, asset, order, contract"
              className="w-full text-[13px] font-mono bg-gray-50 border border-gray-200 focus:border-indigo-400 rounded-lg p-2.5 outline-none transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-700 block uppercase tracking-wide mb-1">Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Master Store Locations & Warehouse Data"
              className="w-full text-[13px] bg-gray-50 border border-gray-200 focus:border-indigo-400 rounded-lg p-2.5 outline-none transition"
            />
          </div>

          <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl space-y-1 text-[11px] text-indigo-900">
            <span className="font-bold text-indigo-700 block uppercase tracking-wide">Target Delta Table DDL:</span>
            <span className="font-mono block text-indigo-800 break-all">
              workspace.default.mdm_gold_master_{(domain || 'custom').toLowerCase()}s
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-[12px] font-bold text-white transition flex items-center gap-1.5 shadow-sm"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)' }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              <span>{saving ? 'Creating Target...' : 'Create Master Target'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Connection Status Banner ─────────────────────────────────────────────────
function ConnectionBanner({
  status,
  loading,
  onRefresh,
}: {
  status: DatabricksConnectionStatus | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[12px] text-gray-500">
        <Loader2 size={13} className="animate-spin" />
        Checking Databricks connection…
      </div>
    );
  }
  if (!status) return null;

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-[12px] font-medium transition-colors
      ${status.connected
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-amber-50/80 border-amber-200 text-amber-900'
      }`}>
      <div className="flex items-center gap-2.5">
        {status.connected
          ? <Wifi size={14} className="shrink-0 text-emerald-600" />
          : <WifiOff size={14} className="shrink-0 text-amber-600" />}
        <span>
          {status.connected
            ? `Connected to Databricks Workspace (${status.host ?? 'Active'})`
            : `Databricks Local Fallback Mode Active — ${status.message.replace(/Databricks connection failed:\s*/gi, '')}`}
        </span>
      </div>
      <button onClick={onRefresh} className="flex items-center gap-1.5 font-bold text-amber-800 hover:text-amber-950 bg-amber-100/60 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition shrink-0 ml-3">
        <RefreshCw size={11} />
        Retry
      </button>
    </div>
  );
}

// ─── Catalog / Schema selectors ───────────────────────────────────────────────
function CatalogSchemaSelector({
  catalogs,
  schemas,
  selectedCatalog,
  selectedSchema,
  loadingCatalogs,
  loadingSchemas,
  errorCatalogs,
  errorSchemas,
  onCatalogChange,
  onSchemaChange,
  onRefresh,
}: {
  catalogs: string[];
  schemas: string[];
  selectedCatalog: string;
  selectedSchema: string;
  loadingCatalogs: boolean;
  loadingSchemas: boolean;
  errorCatalogs: string;
  errorSchemas: string;
  onCatalogChange: (v: string) => void;
  onSchemaChange:  (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Catalog */}
      <div className="flex flex-col gap-1 min-w-[180px]">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Catalog</label>
        <div className="relative">
          {loadingCatalogs && (
            <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-400 pointer-events-none" />
          )}
          <select
            value={selectedCatalog}
            onChange={e => onCatalogChange(e.target.value)}
            disabled={loadingCatalogs || catalogs.length === 0}
            className="w-full appearance-none text-[12px] border border-gray-200 rounded-lg px-3 py-2 pr-8 outline-none
              focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition bg-white disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">— Select catalog —</option>
            {catalogs.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {errorCatalogs && <p className="text-[10px] text-red-500">{errorCatalogs}</p>}
      </div>

      {/* Schema */}
      <div className="flex flex-col gap-1 min-w-[180px]">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Schema</label>
        <div className="relative">
          {loadingSchemas && (
            <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-400 pointer-events-none" />
          )}
          <select
            value={selectedSchema}
            onChange={e => onSchemaChange(e.target.value)}
            disabled={!selectedCatalog || loadingSchemas || schemas.length === 0}
            className="w-full appearance-none text-[12px] border border-gray-200 rounded-lg px-3 py-2 pr-8 outline-none
              focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition bg-white disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">— Select schema —</option>
            {schemas.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {errorSchemas && <p className="text-[10px] text-red-500">{errorSchemas}</p>}
      </div>

      <button
        onClick={onRefresh}
        title="Refresh catalogs"
        className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400
          hover:text-indigo-600 hover:border-indigo-200 transition">
        <RefreshCw size={14} />
      </button>
    </div>
  );
}

// ─── Available Tables section ─────────────────────────────────────────────────
function AvailableTablesSection({
  tables,
  loadingTables,
  errorTables,
  registeredTableNames,
  selectedTableIds,
  onToggle,
  onSelectAll,
  onClearAll,
  onRegister,
  search,
  onSearchChange,
}: {
  tables: DatabricksTable[];
  loadingTables: boolean;
  errorTables: string;
  registeredTableNames: Set<string>;
  selectedTableIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onRegister: () => void;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const filtered = useMemo(() => {
    const businessTables = tables.filter(t => !isInternalMdmTable(t.tableName));
    if (!search) return businessTables;
    return businessTables.filter(t =>
      t.tableName.toLowerCase().includes(search.toLowerCase()) ||
      t.tableType.toLowerCase().includes(search.toLowerCase())
    );
  }, [tables, search]);

  const unregisteredFiltered = filtered.filter(t => !registeredTableNames.has(t.tableName));
  const allSelected = unregisteredFiltered.length > 0 && unregisteredFiltered.every(t => selectedTableIds.has(t.tableId));
  const someSelected = unregisteredFiltered.some(t => selectedTableIds.has(t.tableId));

  return (
    <div className="bg-white border border-gray-100 rounded-2xl card-shadow flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-bold text-gray-900">Available Tables</h3>
          {!loadingTables && (
            <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full">
              {filtered.length} tables
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unregisteredFiltered.length > 0 && (
            <button onClick={allSelected ? onClearAll : onSelectAll}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold transition">
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {someSelected && (
            <button onClick={onClearAll}
              className="text-[11px] text-gray-400 hover:text-red-500 font-semibold transition">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-5 py-3 border-b border-gray-50">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search tables…"
            className="w-full text-[13px] bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-lg py-2 pl-9 pr-4 outline-none transition" />
          {search && (
            <button onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loadingTables ? (
        <div className="flex items-center justify-center py-14 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading tables from Databricks…</span>
        </div>
      ) : errorTables ? (
        <div className="flex items-center gap-2 mx-5 my-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-700">
          <AlertTriangle size={14} className="shrink-0" />
          {errorTables}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState message={search ? `No tables match "${search}"` : 'No tables found. Select a catalog and schema above.'} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pl-5 pr-2 py-2.5 w-10">
                  <button
                    onClick={allSelected ? onClearAll : onSelectAll}
                    className="text-gray-400 hover:text-indigo-600 transition">
                    {allSelected
                      ? <CheckSquare size={15} className="text-indigo-600" />
                      : someSelected
                        ? <CheckSquare size={15} className="text-indigo-400 opacity-60" />
                        : <Square size={15} />}
                  </button>
                </th>
                {['Table Name', 'Type', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => {
                const isRegistered = registeredTableNames.has(t.tableName);
                const isSelected = selectedTableIds.has(t.tableId);
                return (
                  <tr key={t.tableId}
                    className={`group transition-colors ${
                      isRegistered ? 'opacity-50' :
                      isSelected   ? 'bg-indigo-50/50' : 'hover:bg-gray-50/50'
                    }`}>
                    <td className="pl-5 pr-2 py-3">
                      <button disabled={isRegistered} onClick={() => onToggle(t.tableId)} className="transition disabled:cursor-not-allowed">
                        {isRegistered
                          ? <CheckSquare size={15} className="text-emerald-400" />
                          : isSelected
                            ? <CheckSquare size={15} className="text-indigo-600" />
                            : <Square size={15} className="text-gray-300 group-hover:text-gray-400" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`font-mono text-[12px] font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {t.tableName}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[10px] bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-full border border-violet-100">
                        {t.tableType}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {isRegistered
                        ? <span className="text-[10px] bg-emerald-50 text-emerald-600 font-semibold px-2 py-0.5 rounded-full border border-emerald-100">Registered</span>
                        : <span className="text-[10px] text-gray-400">Available</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Register footer */}
      {selectedTableIds.size > 0 && (
        <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between bg-violet-50/40">
          <div>
            <span className="text-[12px] text-violet-700 font-semibold">
              {selectedTableIds.size} table{selectedTableIds.size !== 1 ? 's' : ''} selected
            </span>
            <p className="text-[10px] text-violet-500">Columns will be fetched and auto-mapped to MDM schema.</p>
          </div>
          <button onClick={onRegister}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}>
            Register Selected →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Registered Sources Table ─────────────────────────────────────────────────
function RegisteredSourcesTable({
  sources,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  onDetails,
  onDeleteSource,
  onDeleteSelected,
  search,
  onSearchChange,
  onProcessSelected,
  onRenameColumns,
  onRenameSource,
}: {
  sources: SourceSystem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onDetails: (src: SourceSystem) => void;
  onDeleteSource: (src: SourceSystem) => void;
  onDeleteSelected: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  onProcessSelected: () => void;
  onRenameColumns: (src: SourceSystem) => void;
  onRenameSource: (src: SourceSystem, newName: string, field?: 'sourceName' | 'tableName') => void;
}) {
  // Inline source/table name editing state
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'sourceName' | 'tableName'>('sourceName');
  const [editingName, setEditingName]   = useState('');
  const filtered = useMemo(() =>
    !search ? sources : sources.filter(s =>
      s.sourceName.toLowerCase().includes(search.toLowerCase()) ||
      (s.tableName ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [sources, search]
  );

  const allSelected = filtered.length > 0 && filtered.every(s => selected.has(s.sourceId));
  const someSelected = filtered.some(s => selected.has(s.sourceId));

  return (
    <div className="bg-white border border-gray-100 rounded-2xl card-shadow flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-bold text-gray-900">Registered Sources</h3>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
            {sources.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button onClick={allSelected ? onClearAll : onSelectAll}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold transition">
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {someSelected && (
            <button onClick={onClearAll}
              className="text-[11px] text-gray-400 hover:text-red-500 font-semibold transition">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-b border-gray-50">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => onSearchChange(e.target.value)}
            placeholder="Search registered sources…"
            className="w-full text-[13px] bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-lg py-2 pl-9 pr-4 outline-none transition" />
          {search && (
            <button onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        {filtered.length === 0 ? (
          <EmptyState message={search ? `No sources match "${search}"` : 'No registered sources. Select tables below and click Register.'} />
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pl-5 pr-2 py-2.5 w-10">
                  <button onClick={allSelected ? onClearAll : onSelectAll} className="text-gray-400 hover:text-indigo-600 transition">
                    {allSelected
                      ? <CheckSquare size={15} className="text-indigo-600" />
                      : someSelected
                        ? <CheckSquare size={15} className="text-indigo-400 opacity-60" />
                        : <Square size={15} />}
                  </button>
                </th>
                {['Source Name', 'Table', 'Catalog', 'Schema', 'Priority', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(src => {
                const isSel = selected.has(src.sourceId);
                return (
                  <tr key={src.sourceId}
                    className={`group transition-colors ${isSel ? 'bg-indigo-50/50' : 'hover:bg-gray-50/50'}`}>
                    <td className="pl-5 pr-2 py-3">
                      <button onClick={() => onToggle(src.sourceId)} className="transition">
                        {isSel
                          ? <CheckSquare size={15} className="text-indigo-600" />
                          : <Square size={15} className="text-gray-300 group-hover:text-gray-400" />}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${isSel ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {(editingId === src.sourceId && editingField === 'sourceName' ? editingName : src.sourceName).substring(0, 2).toUpperCase()}
                        </div>
                        {editingId === src.sourceId && editingField === 'sourceName' ? (
                          <input
                            autoFocus
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onBlur={() => {
                              if (editingName.trim() && editingName.trim() !== src.sourceName) {
                                onRenameSource(src, editingName.trim(), 'sourceName');
                              }
                              setEditingId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                if (editingName.trim() && editingName.trim() !== src.sourceName) {
                                  onRenameSource(src, editingName.trim(), 'sourceName');
                                }
                                setEditingId(null);
                              } else if (e.key === 'Escape') {
                                setEditingId(null);
                              }
                            }}
                            onClick={e => e.stopPropagation()}
                            className="text-[12px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-300 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-200 w-36 transition"
                          />
                        ) : (
                          <button
                            title="Click to rename source display name"
                            onClick={e => {
                              e.stopPropagation();
                              setEditingId(src.sourceId);
                              setEditingField('sourceName');
                              setEditingName(src.sourceName);
                            }}
                            className={`text-[12px] font-semibold text-left group/name flex items-center gap-1 ${isSel ? 'text-indigo-700' : 'text-gray-800 hover:text-indigo-600'} transition`}
                          >
                            {src.sourceName}
                            <Pencil size={10} className="opacity-0 group-hover/name:opacity-50 transition shrink-0" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {editingId === src.sourceId && editingField === 'tableName' ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onBlur={() => {
                            if (editingName.trim() && editingName.trim() !== (src.tableName ?? src.fileName)) {
                              onRenameSource(src, editingName.trim(), 'tableName');
                            }
                            setEditingId(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (editingName.trim() && editingName.trim() !== (src.tableName ?? src.fileName)) {
                                onRenameSource(src, editingName.trim(), 'tableName');
                              }
                              setEditingId(null);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          onClick={e => e.stopPropagation()}
                          className="font-mono text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-300 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-200 w-36 transition"
                        />
                      ) : (
                        <button
                          title="Click to rename table name"
                          onClick={e => {
                            e.stopPropagation();
                            setEditingId(src.sourceId);
                            setEditingField('tableName');
                            setEditingName(src.tableName ?? src.fileName ?? '');
                          }}
                          className="font-mono text-[11px] text-gray-600 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 px-2 py-0.5 rounded transition inline-flex items-center gap-1 group/tbl"
                        >
                          <span>{src.tableName ?? src.fileName ?? '—'}</span>
                          <Pencil size={9} className="opacity-0 group-hover/tbl:opacity-60 transition shrink-0 text-indigo-600" />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-gray-500">{src.catalog ?? '—'}</td>
                    <td className="px-3 py-3 text-[11px] text-gray-500">{src.schema ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                        {src.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={src.status} /></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => onDetails(src)}
                          title="View Details"
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition">
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => onRenameColumns(src)}
                          title="Rename Column Display Names"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition">
                          <Pencil size={11} />
                          Rename
                        </button>
                        <button
                          onClick={() => onDeleteSource(src)}
                          title="Remove Table from Registration"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition">
                          <Trash2 size={11} />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected.size > 0 && (
        <div className="px-5 py-3.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-indigo-50/40">
          <span className="text-[12px] text-indigo-700 font-semibold">
            {selected.size} source{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 transition shadow-sm">
              <Trash2 size={12} />
              Remove Selected ({selected.size})
            </button>
            <button onClick={onProcessSelected}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition shadow-sm"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)' }}>
              <Play size={12} />
              Continue to Mapping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Selected Sources chip panel ──────────────────────────────────────────────
function SelectedSourcesPanel({
  selected,
  allSources,
  onRemove,
  onClear,
  onContinue,
}: {
  selected: Set<string>;
  allSources: SourceSystem[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onContinue: () => void;
}) {
  const selectedSources = allSources.filter(s => selected.has(s.sourceId));
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 card-shadow space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold text-gray-900">Selected Sources</h3>
          {selected.size > 0
            ? <span className="h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold">{selected.size}</span>
            : <span className="text-[11px] text-gray-400 font-medium">Nothing selected</span>}
        </div>
        {selected.size > 0 && (
          <button onClick={onClear} className="text-[11px] text-gray-400 hover:text-red-500 font-semibold transition">
            Clear All
          </button>
        )}
      </div>

      {selected.size === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
          <Layers size={20} className="text-gray-200 mx-auto mb-2" />
          <p className="text-[12px] text-gray-400">Select registered sources to process</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {selectedSources.map(s => (
              <span key={s.sourceId}
                className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[12px] font-semibold text-indigo-700 group hover:border-indigo-300 transition">
                <Database size={11} className="shrink-0" />
                {s.sourceName}
                <button onClick={() => onRemove(s.sourceId)}
                  className="ml-0.5 h-4 w-4 flex items-center justify-center rounded-full text-indigo-400 hover:text-white hover:bg-indigo-500 transition">
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
          <button onClick={onContinue}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)' }}>
            Continue → Map Columns
            <ChevronRight size={14} />
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
/** Convert a backend MdmTargetResponse into a MasterDefinition for the UI.
 * Falls back to the static MASTER_DEFINITIONS canonical attributes if the
 * backend does not supply them (e.g. when the backend list is a subset). */
function mdmTargetToMasterDef(t: MdmTargetResponse): MasterDefinition {
  // Try to find matching static definition for canonical attributes fallback
  const staticMatch = MASTER_DEFINITIONS.find(
    m => m.id === t.id || m.name.toLowerCase() === t.name.toLowerCase()
  );

  const canonicalAttributes = (t.canonicalAttributes && t.canonicalAttributes.length > 0)
    ? t.canonicalAttributes.map(a => ({
        name: a.name,
        key: a.key,
        type: (a.type || 'string') as CanonicalAttribute['type'],
        category: (a.category || 'OTHER') as CanonicalAttribute['category'],
        description: a.description,
        required: a.required,
      }))
    : (staticMatch?.canonicalAttributes ?? []);

  const domain = (
    t.domain === 'customer' ? 'customer' :
    t.domain === 'product'  ? 'product' :
    t.domain === 'supplier' ? 'supplier' :
    t.domain === 'employee' ? 'employee' :
    staticMatch?.domain ?? 'customer'
  ) as MasterDefinition['domain'];

  return {
    id:                  t.id,
    name:                t.name,
    domain,
    description:         t.description || staticMatch?.description || '',
    iconName:            t.iconName   || staticMatch?.iconName    || 'Users',
    targetCatalog:       t.targetCatalog,
    targetSchema:        t.targetSchema,
    targetTable:         t.targetTable,
    fullTarget:          t.fullTarget,
    status:              t.status,
    canonicalAttributes,
  };
}

export default function SourceSystemsPage() {
  // ── Master Definition Selection State ──────────────────────────
  const [selectedMaster, setSelectedMaster] = useState<MasterDefinition>(MASTER_DEFINITIONS[0]);
  const [masterDefinitions, setMasterDefinitions] = useState<MasterDefinition[]>(MASTER_DEFINITIONS);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [errorTargets, setErrorTargets] = useState('');

  // ── Connection ─────────────────────────────────────────────────
  const [connStatus, setConnStatus]       = useState<DatabricksConnectionStatus | null>(null);
  const [connLoading, setConnLoading]     = useState(true);

  // ── Catalog / Schema / Table dropdowns ─────────────────────────
  const [catalogs, setCatalogs]           = useState<string[]>([]);
  const [schemas, setSchemas]             = useState<string[]>([]);
  const [discoveredTables, setDiscoveredTables] = useState<DatabricksTable[]>([]);
  const [selectedCatalog, setSelectedCatalog]   = useState('');
  const [selectedSchema, setSelectedSchema]     = useState('');

  const [loadingCatalogs, setLoadingCatalogs]   = useState(false);
  const [loadingSchemas, setLoadingSchemas]     = useState(false);
  const [loadingTables, setLoadingTables]       = useState(false);

  const [errorCatalogs, setErrorCatalogs]       = useState('');
  const [errorSchemas, setErrorSchemas]         = useState('');
  const [errorTables, setErrorTables]           = useState('');

  // ── Master Table Provisioning state ─────────────────────────────
  const [provisioningMaster, setProvisioningMaster] = useState(false);
  const [showCreateTargetModal, setShowCreateTargetModal] = useState(false);

  const handleInitMasterTable = async () => {
    setProvisioningMaster(true);
    try {
      const targetCat = selectedMaster.targetCatalog || 'workspace';
      const targetSch = selectedMaster.targetSchema || 'default';
      const targetTbl = selectedMaster.targetTable || `mdm_gold_master_${selectedMaster.domain}s`;
      const res = await ensureMasterTableExists(targetCat, targetSch, targetTbl);
      showToast(`✓ Master Delta Table "${res.full_target}" provisioned in Databricks!`);
    } catch (e: any) {
      showToast(`❌ Master Table creation note: ${e?.message}`);
    } finally {
      setProvisioningMaster(false);
    }
  };

  const handleCreateCustomTarget = async (data: { name: string; domain: string; description: string; targetTable: string }) => {
    try {
      const res = await createCustomMdmTarget(data);
      const newTarget = res.target;
      const customDef: MasterDefinition = {
        id: newTarget.id,
        name: newTarget.name,
        domain: newTarget.domain as any,
        description: newTarget.description,
        iconName: newTarget.iconName || 'Database',
        targetCatalog: newTarget.targetCatalog || 'workspace',
        targetSchema: newTarget.targetSchema || 'default',
        targetTable: newTarget.targetTable,
        fullTarget: newTarget.fullTarget,
        canonicalAttributes: (newTarget.canonicalAttributes || []).map((a: any) => ({
          name: a.name,
          key: a.key,
          type: a.type || 'string',
          category: a.category || 'OTHER',
          description: a.description,
          required: a.required,
        })),
      };
      setMasterDefinitions(prev => {
        const filtered = prev.filter(m => m.id !== customDef.id);
        return [...filtered, customDef];
      });
      setSelectedMaster(customDef);
      showToast(`✓ Master Target "${customDef.name}" created & provisioned in Databricks!`);
    } catch (e: any) {
      // ── Local fallback: backend unreachable — create definition client-side ──
      const localId = `custom_${data.domain}_${Date.now()}`;
      const localDef: MasterDefinition = {
        id: localId,
        name: data.name,
        domain: data.domain as any,
        description: data.description,
        iconName: 'Database',
        targetCatalog: 'workspace',
        targetSchema: 'default',
        targetTable: data.targetTable,
        fullTarget: `workspace.default.${data.targetTable}`,
        canonicalAttributes: [
          { name: 'MDM ID',      key: 'mdm_id',      type: 'string', category: 'IDENTIFIER', required: true,  description: 'Unique MDM record identifier' },
          { name: 'Source ID',   key: 'source_id',   type: 'string', category: 'IDENTIFIER', required: true,  description: 'Source system identifier' },
          { name: 'Source Name', key: 'source_name', type: 'string', category: 'DESCRIPTOR', required: false, description: 'Source system name' },
          { name: 'Created At',  key: 'created_at',  type: 'string', category: 'TEMPORAL',   required: false, description: 'Record creation timestamp' },
          { name: 'Updated At',  key: 'updated_at',  type: 'string', category: 'TEMPORAL',   required: false, description: 'Last update timestamp' },
        ],
      };
      setMasterDefinitions(prev => [...prev, localDef]);
      setSelectedMaster(localDef);
      showToast(`✓ Master Target "${data.name}" added locally (backend offline — DDL will run on next connect).`);
    }
  };

  // ── Registered sources ─────────────────────────────────────────
  const [registeredSources, setRegisteredSources] = useState<SourceSystem[]>([]);
  const [loadingSources, setLoadingSources]       = useState(true);

  // ── Selection state (single source of truth) ───────────────────
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [selectedTableIds, setSelectedTableIds]   = useState<Set<string>>(new Set());

  // ── Search ─────────────────────────────────────────────────────
  const [sourceSearch, setSourceSearch]   = useState('');
  const [tableSearch, setTableSearch]     = useState('');

  // ── UI state ───────────────────────────────────────────────────
  const [view, setView]                   = useState<View>('list');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [detailSource, setDetailSource]   = useState<SourceSystem | null>(null);
  const [sourceToDelete, setSourceToDelete] = useState<SourceSystem | null>(null);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState(false);
  const [confirmRollback, setConfirmRollback]       = useState(false);
  const [toast, setToast]                 = useState('');
  const [registering, setRegistering]     = useState(false);
  const [renameSource, setRenameSource]   = useState<SourceSystem | null>(null);

  // ── Derived ────────────────────────────────────────────────────
  const registeredTableNames = useMemo(
    () => new Set(registeredSources.map(s => s.tableName ?? '')),
    [registeredSources]
  );

  const selectedForProcessing = useMemo(
    () => registeredSources.filter(s => selectedSourceIds.has(s.sourceId)),
    [registeredSources, selectedSourceIds]
  );

  // ── Toast helper ───────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // ── Connection check ───────────────────────────────────────────
  const checkConn = useCallback(async () => {
    setConnLoading(true);
    try {
      const s = await checkDatabricksConnection();
      setConnStatus(s);
    } catch {
      setConnStatus({ connected: false, message: 'Backend not reachable. Is the FastAPI server running?' });
    } finally {
      setConnLoading(false);
    }
  }, []);

  // ── Load catalogs ──────────────────────────────────────────────
  const loadCatalogs = useCallback(async () => {
    setLoadingCatalogs(true);
    setErrorCatalogs('');
    setCatalogs([]);
    setSchemas([]);
    setDiscoveredTables([]);
    setSelectedCatalog('');
    setSelectedSchema('');
    try {
      const cats = await fetchCatalogs();
      setCatalogs(cats);
    } catch (e: any) {
      setErrorCatalogs(e?.message ?? 'Failed to load catalogs');
    } finally {
      setLoadingCatalogs(false);
    }
  }, []);

  // ── Load schemas when catalog changes ──────────────────────────
  useEffect(() => {
    if (!selectedCatalog) { setSchemas([]); setSelectedSchema(''); return; }
    setLoadingSchemas(true);
    setErrorSchemas('');
    setSchemas([]);
    setSelectedSchema('');
    setDiscoveredTables([]);
    fetchSchemas(selectedCatalog)
      .then(s => setSchemas(s))
      .catch((e: any) => setErrorSchemas(e?.message ?? 'Failed to load schemas'))
      .finally(() => setLoadingSchemas(false));
  }, [selectedCatalog]);

  // ── Load tables when schema changes ───────────────────────────
  useEffect(() => {
    if (!selectedCatalog || !selectedSchema) { setDiscoveredTables([]); return; }
    setLoadingTables(true);
    setErrorTables('');
    setDiscoveredTables([]);
    setSelectedTableIds(new Set());
    fetchTables(selectedCatalog, selectedSchema)
      .then(t => setDiscoveredTables(t))
      .catch((e: any) => setErrorTables(e?.message ?? 'Failed to load tables'))
      .finally(() => setLoadingTables(false));
  }, [selectedCatalog, selectedSchema]);

  // ── Load registered sources ────────────────────────────────────
  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const s = await mockSourceSystemService.getSources();
      setRegisteredSources(s);
    } finally { setLoadingSources(false); }
  }, []);

  // ── Load MDM Targets from backend ─────────────────────────────
  const loadMdmTargets = useCallback(async () => {
    setLoadingTargets(true);
    setErrorTargets('');
    try {
      const targets = await fetchMdmTargets();
      if (targets && targets.length > 0) {
        const defs = targets.map(mdmTargetToMasterDef);
        setMasterDefinitions(defs);
        // Keep selected master in sync — prefer matching by id, else pick first
        setSelectedMaster(prev => {
          const match = defs.find(d => d.id === prev.id);
          return match ?? defs[0];
        });
      }
    } catch (e: any) {
      // Non-fatal: fall back to static definitions
      setErrorTargets(e?.message ?? 'Failed to load MDM targets from backend');
      console.warn('MDM targets fetch fell back to static definitions:', e?.message);
    } finally {
      setLoadingTargets(false);
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────
  useEffect(() => {
    checkConn();
    loadCatalogs();
    loadSources();
    loadMdmTargets();
  }, [checkConn, loadCatalogs, loadSources, loadMdmTargets]);

  // ── Source selection ───────────────────────────────────────────
  const toggleSource = (id: string) =>
    setSelectedSourceIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });

  const selectAllSources = () => {
    const filtered = !sourceSearch ? registeredSources : registeredSources.filter(s =>
      s.sourceName.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      (s.tableName ?? '').toLowerCase().includes(sourceSearch.toLowerCase())
    );
    setSelectedSourceIds(prev => { const n = new Set(prev); filtered.forEach(s => n.add(s.sourceId)); return n; });
  };

  const clearAllSources = () => setSelectedSourceIds(new Set());
  const removeSource = (id: string) =>
    setSelectedSourceIds(prev => { const n = new Set(prev); n.delete(id); return n; });

  // ── Table selection ────────────────────────────────────────────
  const toggleTable = (id: string) =>
    setSelectedTableIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });

  const selectAllTables = () => {
    const unregd = discoveredTables.filter(t => !registeredTableNames.has(t.tableName));
    setSelectedTableIds(prev => { const n = new Set(prev); unregd.forEach(t => n.add(t.tableId)); return n; });
  };

  const clearAllTables = () => setSelectedTableIds(new Set());

  // ── Register selected Databricks tables as MDM sources ─────────
  const handleRegisterTables = async () => {
    if (selectedTableIds.size === 0 || registering) return;
    setRegistering(true);
    try {
      const avTables: AvailableTable[] = [];
      for (const tableId of selectedTableIds) {
        const dbTable = discoveredTables.find(t => t.tableId === tableId);
        if (!dbTable) continue;
        let colNames: string[] = [];
        let rowCount = 0;
        try {
          const cols = await fetchColumns(dbTable.catalog, dbTable.schema, dbTable.tableName);
          colNames = cols.map(c => c.name);
        } catch {
          colNames = [];
        }
        try {
          const countRes = await fetchTableCount(dbTable.catalog, dbTable.schema, dbTable.tableName);
          rowCount = countRes.rowCount || 0;
        } catch {
          rowCount = 0;
        }
        avTables.push({
          tableId:     dbTable.tableId,
          tableName:   dbTable.tableName,
          catalog:     dbTable.catalog,
          schema:      dbTable.schema,
          tableType:   dbTable.tableType,
          recordCount: rowCount,
          columnCount: colNames.length,
          lastUpdated: new Date().toISOString(),
          columns:     colNames,
        });
      }

      const tableIds = avTables.map(t => t.tableId);
      await mockSourceSystemService.registerTablesAsSources(tableIds, avTables);
      await loadSources();
      setSelectedTableIds(new Set());
      showToast(`✓ ${avTables.length} source table${avTables.length !== 1 ? 's' : ''} registered into ${selectedMaster.name}`);
    } catch (e: any) {
      showToast(`❌ Registration failed: ${e?.message}`);
    } finally {
      setRegistering(false);
    }
  };

  // ── Proceed to mapping ─────────────────────────────────────────
  const handleContinueToMapping = () => {
    if (selectedSourceIds.size === 0) return;
    setView('mapping');
  };

  // ── Rename columns handler ─────────────────────────────────────
  const handleSaveRenames = async (src: SourceSystem, renames: Record<string, string>) => {
    // Store renames as columnAliases on the source object
    const updated = { ...(src as any), columnAliases: renames };
    await mockSourceSystemService.updateSource(src.sourceId, updated as any);
    await loadSources();
    setRenameSource(null);
    const changedCount = Object.keys(renames).filter(k => renames[k] !== k).length;
    showToast(`✓ ${changedCount} column${changedCount !== 1 ? 's' : ''} renamed in "${src.sourceName}"`);
  };

  // ── Rename source / table name handler ─────────────────────────────
  const handleRenameSource = async (src: SourceSystem, newName: string, field: 'sourceName' | 'tableName' = 'sourceName') => {
    const patch: Partial<SourceSystem> = field === 'tableName'
      ? { tableName: newName }
      : { sourceName: newName };
    await mockSourceSystemService.updateSource(src.sourceId, patch);
    await loadSources();
    showToast(`✓ Renamed ${field === 'tableName' ? 'table' : 'source'} to "${newName}"`);
  };

  const handleMappingSaved = async (updatedSources: SourceSystem[]) => {
    for (const s of updatedSources) {
      await mockSourceSystemService.updateSource(s.sourceId, { columnMappings: s.columnMappings });
    }
    await loadSources();

    // Prepare backend payload for PySpark / Splink engine
    try {
      const backendPayload = updatedSources.map(s => {
        const mapDict: Record<string, string> = {};
        (s.columnMappings || []).forEach(m => {
          if (m.targetColumn) {
            mapDict[m.targetColumn] = m.sourceColumn;
          }
        });
        return {
          catalog: s.catalog || 'workspace',
          schema: s.schema || 'default',
          table: s.tableName || s.sourceName,
          priority: s.priority || 1,
          entity_type: selectedMaster.name.toUpperCase(),
          mapping: mapDict,
        };
      });
      await registerSourceSystems(backendPayload);
    } catch (err) {
      console.warn('Backend source registration warning:', err);
    }

    setView('processing');
  };

  const handleSourceSaved = async (src: SourceSystem) => {
    setShowAddModal(false);
    await loadSources();
    showToast(`✓ "${src.sourceName}" registered`);
  };

  const handleDisableSource = async (src: SourceSystem) => {
    await mockSourceSystemService.updateSource(src.sourceId, { status: 'inactive' });
    setDetailSource(null);
    await loadSources();
    showToast(`"${src.sourceName}" disabled`);
  };

  const handleDeleteSingleSource = async (src: SourceSystem) => {
    await mockSourceSystemService.deleteSource(src.sourceId);
    setSourceToDelete(null);
    if (detailSource?.sourceId === src.sourceId) setDetailSource(null);
    setSelectedSourceIds(prev => {
      const n = new Set(prev);
      n.delete(src.sourceId);
      return n;
    });
    await loadSources();
    showToast(`✓ Removed table "${src.tableName || src.sourceName}" from registered sources`);
  };

  const handleDeleteSelectedSources = async () => {
    const ids = Array.from(selectedSourceIds);
    if (ids.length === 0) return;
    await mockSourceSystemService.deleteMultipleSources(ids);
    setConfirmDeleteBatch(false);
    setSelectedSourceIds(new Set());
    await loadSources();
    showToast(`✓ Removed ${ids.length} table(s) from registered sources`);
  };

  const handleRollbackPipeline = () => {
    rollbackPipelineRun();
    setConfirmRollback(false);
    showToast('✓ MDM Pipeline rolled back. Golden and Master records cleared.');
  };

  const handleRunFromDetails = (src: SourceSystem) => {
    setSelectedSourceIds(new Set([src.sourceId]));
    setDetailSource(null);
    setView('processing');
  };

  // ── Render sub-views ───────────────────────────────────────────
  if (view === 'mapping') {
    return (
      <SchemaMapping
        sources={selectedForProcessing}
        master={selectedMaster}
        onSave={handleMappingSaved}
        onBack={() => setView('list')}
      />
    );
  }

  if (view === 'processing') {
    return (
      <ProcessingStatus
        sources={selectedForProcessing}
        master={selectedMaster}
        onClose={() => { setView('list'); setSelectedSourceIds(new Set()); }}
      />
    );
  }

  // ── Main list view ─────────────────────────────────────────────
  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-[12px] font-semibold px-4 py-2.5 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-gray-900">Source Systems & Master Definition</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Select target Master MDM definition, discover Databricks tables, register sources, and configure schema mappings.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { checkConn(); loadCatalogs(); loadSources(); }}
            title="Refresh Sources & Databricks Connection"
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 transition">
            <RefreshCw size={14} className={(connLoading || loadingCatalogs || loadingSources) ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setConfirmRollback(true)}
            title="Rollback MDM Pipeline and reset generated golden records"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 transition shadow-sm">
            <RotateCcw size={13} />
            Rollback Pipeline
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition shadow-sm"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)' }}>
            <Plus size={14} />
            Add Source System
          </button>
        </div>
      </div>

      {/* Active MDM Target info bar with Master Domain Selector & DDL Provisioning */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-[12px] flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck size={13} className="text-indigo-500 shrink-0" />
          <span className="font-semibold text-indigo-700">Active Master Target:</span>
          <select
            value={selectedMaster.id}
          onChange={(e) => {
              if (e.target.value === '__new__') {
                // Reset select back to current selection, then open modal
                e.target.value = selectedMaster.id;
                setShowCreateTargetModal(true);
                return;
              }
              const found = masterDefinitions.find(m => m.id === e.target.value);
              if (found) setSelectedMaster(found);
            }}
            className="text-[12px] font-bold text-indigo-900 bg-white border border-indigo-200 rounded-lg px-2.5 py-1 outline-none focus:ring-2 focus:ring-indigo-300 transition cursor-pointer"
          >
            {masterDefinitions.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.domain.toUpperCase()})
              </option>
            ))}
            <option value="__new__">+ Create New Master Target...</option>
          </select>
          <button
            onClick={() => setShowCreateTargetModal(true)}
            title="Create a new custom Master Domain and Databricks Delta Table"
            className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-md transition shrink-0 flex items-center gap-1 shadow-sm"
          >
            <Plus size={10} />
            <span>New Domain</span>
          </button>
          <span className="text-indigo-400 mx-1">·</span>
          <span className="text-indigo-600 truncate max-w-xs md:max-w-md">{selectedMaster.description}</span>
          <span className="text-indigo-400 mx-1">·</span>
          <span className="font-mono text-[11px] text-indigo-800 bg-indigo-100/70 px-2 py-0.5 rounded border border-indigo-200">
            workspace.default.{selectedMaster.targetTable || `mdm_gold_master_${selectedMaster.domain}s`}
          </span>
          {errorTargets && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle size={11} />
              Using default definitions
            </span>
          )}
        </div>
        <button
          onClick={handleInitMasterTable}
          disabled={provisioningMaster}
          title="Execute Databricks DDL (CREATE TABLE IF NOT EXISTS) for active Master Delta table"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-200 transition shadow-sm shrink-0 ml-auto"
        >
          {provisioningMaster ? <Loader2 size={11} className="animate-spin text-indigo-600" /> : <Database size={11} className="text-indigo-600" />}
          <span>{provisioningMaster ? 'Provisioning Table...' : 'Ensure Master Table DDL'}</span>
        </button>
      </div>

      {/* Databricks connection status */}
      <ConnectionBanner status={connStatus} loading={connLoading} onRefresh={checkConn} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">

          {/* Registered sources */}
          {loadingSources ? (
            <div className="h-40 bg-gray-50 rounded-2xl animate-pulse" />
          ) : (
            <RegisteredSourcesTable
              sources={registeredSources}
              selected={selectedSourceIds}
              onToggle={toggleSource}
              onSelectAll={selectAllSources}
              onClearAll={clearAllSources}
              onDetails={setDetailSource}
              onDeleteSource={setSourceToDelete}
              onDeleteSelected={() => setConfirmDeleteBatch(true)}
              search={sourceSearch}
              onSearchChange={setSourceSearch}
              onProcessSelected={handleContinueToMapping}
              onRenameColumns={setRenameSource}
              onRenameSource={handleRenameSource}
            />
          )}

          {/* Discover tables from Databricks */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[13px] font-bold text-gray-700">Discover Tables from Databricks</h3>
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 font-semibold px-2 py-0.5 rounded-full border border-amber-100">
                <Info size={9} />
                Select catalog and schema to register into {selectedMaster.name}
              </span>
            </div>

            {/* Catalog / Schema selectors */}
            <div className="mb-4">
              <CatalogSchemaSelector
                catalogs={catalogs}
                schemas={schemas}
                selectedCatalog={selectedCatalog}
                selectedSchema={selectedSchema}
                loadingCatalogs={loadingCatalogs}
                loadingSchemas={loadingSchemas}
                errorCatalogs={errorCatalogs}
                errorSchemas={errorSchemas}
                onCatalogChange={setSelectedCatalog}
                onSchemaChange={setSelectedSchema}
                onRefresh={() => { loadCatalogs(); }}
              />
            </div>

            {/* Show table list only once a schema is selected */}
            {selectedSchema ? (
              <AvailableTablesSection
                tables={discoveredTables}
                loadingTables={loadingTables || registering}
                errorTables={errorTables}
                registeredTableNames={registeredTableNames}
                selectedTableIds={selectedTableIds}
                onToggle={toggleTable}
                onSelectAll={selectAllTables}
                onClearAll={clearAllTables}
                onRegister={handleRegisterTables}
                search={tableSearch}
                onSearchChange={setTableSearch}
              />
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-10 text-center">
                <Database size={28} className="text-gray-200 mx-auto mb-3" />
                <p className="text-[13px] text-gray-400">
                  {selectedCatalog ? 'Select a schema to load tables' : 'Select a catalog and schema to discover tables'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Selected sources chip panel */}
          <SelectedSourcesPanel
            selected={selectedSourceIds}
            allSources={registeredSources}
            onRemove={removeSource}
            onClear={clearAllSources}
            onContinue={handleContinueToMapping}
          />

          {/* Pipeline flow info */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
            <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest">Pipeline Flow</p>
            {[
              `1. Select Target Master (${selectedMaster.name})`,
              '2. Select & register source tables',
              '3. Map columns to Master attributes',
              '4. Data cleaning & standardization',
              '5. MDM Entity resolution',
              '6. Clustering & survivorship',
              '7. Golden records generated',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-indigo-600">
                <span className="h-4 w-4 rounded-full bg-indigo-200 text-indigo-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddSourceSystem
          availableTables={discoveredTables.map(t => ({
            tableId:     t.tableId,
            tableName:   t.tableName,
            catalog:     t.catalog,
            schema:      t.schema,
            tableType:   t.tableType,
            recordCount: 0,
            columnCount: 0,
            lastUpdated: new Date().toISOString(),
          }))}
          onClose={() => setShowAddModal(false)}
          onSaved={handleSourceSaved}
        />
      )}

      {detailSource && (
        <SourceDetails
          source={detailSource}
          onClose={() => setDetailSource(null)}
          onEdit={() => { setDetailSource(null); setShowAddModal(true); }}
          onDisable={handleDisableSource}
          onDelete={src => { setDetailSource(null); setSourceToDelete(src); }}
          onRunProcessing={handleRunFromDetails}
        />
      )}

      {/* Rename Columns Modal */}
      {renameSource && (
        <RenameColumnsModal
          source={renameSource}
          onClose={() => setRenameSource(null)}
          onSave={handleSaveRenames}
        />
      )}

      {/* Create Custom Master Target Modal */}
      {showCreateTargetModal && (
        <CreateTargetModal
          onClose={() => setShowCreateTargetModal(false)}
          onCreate={handleCreateCustomTarget}
        />
      )}

      {/* Single Source Delete Confirmation Modal */}
      {sourceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Remove Registered Table</h3>
                <p className="text-[12px] text-gray-500">Unregister from {selectedMaster.name}</p>
              </div>
            </div>
            <p className="text-[13px] text-gray-600">
              Are you sure you want to remove table <strong className="text-gray-900 font-mono">"{sourceToDelete.tableName || sourceToDelete.sourceName}"</strong> ({sourceToDelete.catalog}.{sourceToDelete.schema}) from registered sources?
            </p>
            <p className="text-[11px] text-gray-400 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              This will unregister this table and exclude it from all subsequent MDM pipeline executions.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSourceToDelete(null)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSingleSource(sourceToDelete)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 transition shadow-sm">
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {confirmDeleteBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Remove Selected Tables</h3>
                <p className="text-[12px] text-gray-500">Unregister {selectedSourceIds.size} table(s)</p>
              </div>
            </div>
            <p className="text-[13px] text-gray-600">
              Are you sure you want to remove the <strong>{selectedSourceIds.size} selected tables</strong> from registered sources?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteBatch(false)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleDeleteSelectedSources}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 transition shadow-sm">
                Remove Selected ({selectedSourceIds.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Rollback Confirmation Modal */}
      {confirmRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Rollback MDM Pipeline</h3>
                <p className="text-[12px] text-gray-500">Reset golden records and clusters</p>
              </div>
            </div>
            <p className="text-[13px] text-gray-600">
              Are you sure you want to rollback the pipeline run?
            </p>
            <div className="text-[12px] text-red-700 bg-red-50 p-3 rounded-xl border border-red-100 space-y-1">
              <p className="font-semibold">This action will:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-600">
                <li>Clear all generated Golden Records registry entries</li>
                <li>Reset Master customer clusters and duplicate review queue</li>
                <li>Preserve your registered Databricks source table mappings so you can rerun anytime</li>
              </ul>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmRollback(false)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleRollbackPipeline}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 transition shadow-sm flex items-center gap-1.5">
                <RotateCcw size={13} />
                Yes, Rollback Pipeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
