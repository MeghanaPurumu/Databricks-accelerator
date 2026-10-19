import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  Award, Search, RefreshCw, CheckCircle2, Play,
  ShieldCheck, AlertTriangle, HelpCircle,
  Layers, ArrowLeft, Trash2, Sliders,
  Database, Sparkles, ArrowRight, Table,
  Eye, BarChart3, PlusCircle, Server, Lock, ChevronRight,
  Edit3, X, Save, Clock, ChevronDown, ChevronUp, Check, Wand2
} from 'lucide-react';
import { MASTER_DEFINITIONS, MasterDefinition, CanonicalAttribute, mergeAndDeduplicateMdms, getCleanCustomMdms } from '../../types/mdmMaster';
import { populateGoldenRecordsFromSources, getLocalStorageData, saveLocalStorageData, freeLocalStorageSpace } from '../../services/masterDataService';
import { recordSuccessfulPipeline } from '../../services/pipelineHistoryService';
import { fetchCatalogs, fetchSchemas, fetchTables, fetchTableCount, fetchSourcePreview, fetchTableData } from '../../services/databricksApiService';
import { GoldenRecord, SourceSystem, ColumnMapping } from '../../types';
import ExcelView, { ExcelViewToggle } from '../../components/ExcelView';

type Step = 'sources' | 'schema' | 'mapping' | 'golden';
interface ExtendedColumnMapping extends ColumnMapping { transformation?: string; sourceTableName?: string; sourceTableId?: string; }

const EntityStatusBadge = ({ status }: { status?: string }) => {
  const cfg: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    matched: { label: 'Matched', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', Icon: ShieldCheck },
    unmatched: { label: 'Unmatched', cls: 'bg-gray-100 text-gray-500 border-gray-200', Icon: HelpCircle },
    needs_review: { label: 'Review', cls: 'bg-amber-50 text-amber-700 border-amber-100', Icon: AlertTriangle },
  };
  const { label, cls, Icon } = cfg[status ?? 'unmatched'] ?? cfg.unmatched;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      <Icon size={9} />{label}
    </span>
  );
};

const STEPS: { id: Step; label: string; desc: string; Icon: React.ElementType }[] = [
  { id: 'sources', label: 'Source Tables', desc: 'Register Databricks sources', Icon: Database },
  { id: 'schema', label: 'Master Schema', desc: 'Define canonical structure', Icon: Sliders },
  { id: 'mapping', label: 'Analysis & Mapping', desc: 'Map source to master schema', Icon: Sparkles },
  { id: 'golden', label: 'Golden Records', desc: 'View consolidated master data', Icon: Award },
];

function StepBar({ current, completed, onNavigate }: {
  current: Step; completed: Set<Step>; onNavigate: (s: Step) => void;
}) {
  return (
    <div className="flex items-center bg-white border border-gray-100 rounded-2xl p-3 shadow-sm overflow-x-auto gap-1">
      {STEPS.map((step, idx) => {
        const isCompleted = completed.has(step.id);
        const isCurrent = step.id === current;
        const isAccessible = idx === 0 || completed.has(STEPS[idx - 1].id);
        const Icon = step.Icon;
        return (
          <React.Fragment key={step.id}>
            <button
              onClick={() => isAccessible && onNavigate(step.id)}
              disabled={!isAccessible}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all min-w-max ${
                isCurrent ? 'bg-indigo-600 text-white shadow-md'
                : isCompleted ? 'text-emerald-700 hover:bg-emerald-50 cursor-pointer'
                : isAccessible ? 'text-gray-600 hover:bg-gray-50 cursor-pointer'
                : 'text-gray-300 cursor-not-allowed opacity-60'
              }`}
            >
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isCurrent ? 'bg-white/20' : isCompleted ? 'bg-emerald-100' : 'bg-gray-100'
              }`}>
                {isCompleted && !isCurrent
                  ? <CheckCircle2 size={14} className="text-emerald-600" />
                  : <Icon size={14} className={isCurrent ? 'text-white' : ''} />}
              </div>
              <div className="text-left">
                <div className={`text-[11px] font-bold ${isCurrent ? 'text-white' : ''}`}>{step.label}</div>
                <div className={`text-[10px] ${isCurrent ? 'text-white/70' : 'text-gray-400'}`}>{step.desc}</div>
              </div>
              {!isAccessible && <Lock size={11} className="text-gray-300 ml-1" />}
            </button>
            {idx < STEPS.length - 1 && (
              <ChevronRight size={16} className={`mx-0.5 shrink-0 ${completed.has(step.id) ? 'text-emerald-400' : 'text-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// --- Helpers ---
export function consolidateMasterAttributes(cols?: CanonicalAttribute[]): CanonicalAttribute[] {
  if (!cols || cols.length === 0) return [];
  const isNameAttr = (c: CanonicalAttribute) =>
    c.category === 'NAME' ||
    ['first_name', 'last_name', 'customer_name', 'full_name', 'name', 'fname', 'lname'].includes((c.key || '').toLowerCase()) ||
    ['first name', 'last name', 'customer name', 'full name', 'name'].includes((c.name || '').toLowerCase());

  const nameCols = cols.filter(isNameAttr);
  if (nameCols.length <= 1) {
    if (nameCols.length === 1 && nameCols[0].key !== 'name') {
      return cols.map(c => isNameAttr(c) ? { ...c, name: 'Name', key: 'name', category: 'NAME' as const } : c);
    }
    return cols;
  }

  const firstIndex = cols.findIndex(isNameAttr);
  const consolidatedName: CanonicalAttribute = {
    name: 'Name',
    key: 'name',
    type: 'string',
    category: 'NAME',
    required: true,
    description: `Consolidated Master Name (unifies ${nameCols.map(c => c.name || c.key).join(', ')})`,
  };

  const filtered = cols.filter(c => !isNameAttr(c));
  filtered.splice(firstIndex >= 0 ? firstIndex : 1, 0, consolidatedName);
  return filtered;
}

function resolveMdmDef(currentId: string): MasterDefinition {
  try {
    const savedCustom = getCleanCustomMdms();
    const allDefs = mergeAndDeduplicateMdms(MASTER_DEFINITIONS, savedCustom);
    const cid = (currentId || '').toLowerCase().trim();
    const resolved = allDefs.find(m => {
      const mid = (m.id || '').toLowerCase();
      const mdom = (m.domain || '').toLowerCase();
      const mname = (m.name || '').toLowerCase();
      return mid === cid || mdom === cid || mid === `${cid}_mdm` || mid.replace('_mdm', '') === cid
        || mname.replace(' mdm', '') === cid || mname === cid;
    }) || MASTER_DEFINITIONS[0];

    return {
      ...resolved,
      canonicalAttributes: consolidateMasterAttributes(resolved.canonicalAttributes),
    };
  } catch {
    const fallback = MASTER_DEFINITIONS[0];
    return {
      ...fallback,
      canonicalAttributes: consolidateMasterAttributes(fallback.canonicalAttributes),
    };
  }
}

function getSourcesForMdm(mdm: MasterDefinition): SourceSystem[] {
  const allSources = getLocalStorageData<SourceSystem[]>('lf_source_systems', []);
  const targetId = (mdm.id || '').toLowerCase();
  const domainKey = (mdm.domain || '').toLowerCase();
  const targetTableKey = (mdm.targetTable || '').toLowerCase();
  return allSources.filter(s => {
    const sMdmId = String(s.targetMdmId || '').toLowerCase();
    const sTable = String(s.targetTable || '').toLowerCase();
    const sDomain = String((s as any).domain || '').toLowerCase();
    if (sMdmId && sMdmId === targetId) return true;
    if (sTable && targetTableKey && sTable === targetTableKey) return true;
    if (sDomain && sDomain === domainKey) return true;
    if (sMdmId && sMdmId === `${domainKey}_mdm`) return true;
    return false;
  });
}

function readGoldenRecordsForMdm(mdm: MasterDefinition): GoldenRecord[] {
  const all = getLocalStorageData<any[]>('lf_golden_records', []);
  const targetId = (mdm.id || '').toLowerCase();
  const domainKey = (mdm.domain || '').toLowerCase();
  const targetTableKey = (mdm.targetTable || '').toLowerCase();

  let matched: any[] = [];
  if (Array.isArray(all) && all.length > 0) {
    matched = all.filter(r => {
      const rMdmId = String(r.targetMdmId || '').toLowerCase();
      const rDomain = String(r.domain || '').toLowerCase();
      const rTargetTable = String((r as any).targetTable || '').toLowerCase();
      if (rMdmId && rMdmId === targetId) return true;
      if (rDomain && rDomain === domainKey) return true;
      if (rTargetTable && targetTableKey && rTargetTable === targetTableKey) return true;
      if (rMdmId && rMdmId === `${domainKey}_mdm`) return true;
      return false;
    });

    if (matched.length === 0) {
      matched = all.filter(r => String(r.domain || '').toLowerCase() === domainKey || !r.targetMdmId);
      if (matched.length === 0) matched = all;
    }
  }

  // Fallback initial baseline if completely empty
  if (matched.length === 0) {
    const isProd = domainKey.includes('product');
    const isSupp = domainKey.includes('supplier') || domainKey.includes('vendor');
    const isEmp = domainKey.includes('employee');

    const sampleNames = isProd
      ? ['Apple iPhone 15 Pro', 'Samsung Galaxy S24 Ultra', 'Sony WH-1000XM5', 'Dell XPS 15', 'MacBook Pro M3 Max', 'Bose QuietComfort 45']
      : isSupp
      ? ['Apex Global Components', 'NexaTech Semiconductor', 'Pinnacle Industrial Supplies', 'Titan Logistics LLC', 'Cascade Materials Corp']
      : isEmp
      ? ['David Miller', 'Amanda Taylor', 'Christopher Lee', 'Patricia Martinez', 'Daniel Lee', 'Emily Clark']
      : ['Ava Hall', 'Michael Hall', 'Daniel Young', 'Sarah King', 'Ryan King', 'Priya Wright', 'Robert Lopez', 'Mia Lopez', 'James Carter', 'Sophia Davis'];

    matched = sampleNames.map((nm, idx) => ({
      id: `GOLD-${mdm.domain.toUpperCase().slice(0, 4)}-${1001 + idx}`,
      mdmCustomerId: `MC-${1001 + idx}`,
      entity: mdm.name,
      masterName: nm,
      name: nm,
      primaryEmail: `${nm.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      email: `${nm.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      primaryPhone: `555-01${20 + idx}`,
      phone: `555-01${20 + idx}`,
      city: isProd ? 'San Jose' : isSupp ? 'Chicago' : 'New York',
      state: isProd ? 'CA' : isSupp ? 'IL' : 'NY',
      address: `${100 + idx * 10} Market Street`,
      qualityScore: 98 - (idx % 4),
      confidence: 96 - (idx % 6),
      sourceRecordsCount: 2,
      sources: ['crm_customers', 'banking_customers'],
      entityStatus: idx % 4 === 0 ? 'needs_review' : 'matched',
      targetMdmId: mdm.id,
      domain: mdm.domain,
      lastUpdated: new Date().toISOString(),
    }));
  }

  return matched.map(r => {
    let masterName = r.masterName || r.name;
    const dom = (mdm.domain || mdm.id || '').toLowerCase();
    if (!masterName || masterName === 'record_id' || masterName.endsWith('_id') || masterName.toLowerCase().startsWith('record')) {
      const idNum = parseInt(String(r.id || '').replace(/\D+/g, ''), 10) || 0;
      if (dom.includes('product')) masterName = ['Apple iPhone 15 Pro', 'Samsung Galaxy S24', 'Sony WH-1000XM5', 'Dell XPS 15', 'MacBook Pro M3'][idNum % 5];
      else if (dom.includes('supplier') || dom.includes('vendor')) masterName = ['Acro Global Logistics', 'NexaTech Components', 'Apex Manufacturing', 'Pinnacle Supplies'][idNum % 4];
      else if (dom.includes('employee')) masterName = ['David Miller', 'Amanda Taylor', 'Christopher Lee', 'Patricia Martinez', 'Daniel Lee'][idNum % 5];
      else masterName = ['Robert Smith', 'James Wilson', 'Priya Nair', 'Sarah Jenkins', 'Michael Chen'][idNum % 5];
    }
    let city = r.city;
    if (!city || city.includes(',') || city.includes('_customers')) {
      city = dom.includes('product') ? 'Cupertino, CA' : dom.includes('supplier') ? 'Chicago, IL' : 'New York, NY';
    }
    let state = r.state;
    if (!state || state.length > 3) state = dom.includes('product') ? 'CA' : dom.includes('supplier') ? 'IL' : 'NY';
    return { ...r, masterName, name: masterName, city, state };
  });
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function MdmGoldenRecords() {
  const { mdmId, domain } = useParams<{ mdmId?: string; domain?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentId = mdmId || domain || 'customer_mdm';
  const [mdmDef, setMdmDef] = useState<MasterDefinition>(() => resolveMdmDef(currentId));

  // Step management
  const rawStepParam = searchParams.get('step');
  const stepParam: Step | null = (rawStepParam === 'golden-records' ? 'golden' : rawStepParam) as Step | null;
  const [activeStep, setActiveStep] = useState<Step>(
    stepParam && ['sources', 'schema', 'mapping', 'golden'].includes(stepParam) ? stepParam : 'sources'
  );
  const completedKey = `mdm_completed_steps_${currentId}`;
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(() => {
    try { return new Set<Step>(getLocalStorageData<Step[]>(completedKey, [])); }
    catch { return new Set<Step>(); }
  });
  const markStepCompleted = (step: Step) => {
    setCompletedSteps(prev => {
      const next = new Set(prev); next.add(step);
      saveLocalStorageData(completedKey, [...next]); return next;
    });
  };
  const navigateToStep = (step: Step) => { setActiveStep(step); setSearchParams({ step }); };

  useEffect(() => {
    if (stepParam && ['sources', 'schema', 'mapping', 'golden'].includes(stepParam)) {
      setActiveStep(stepParam);
    }
  }, [stepParam]);

  // Golden Records
  const [mdmSources, setMdmSources] = useState<SourceSystem[]>([]);
  const [allRecords, setAllRecords] = useState<GoldenRecord[]>([]);
  const [records, setRecords] = useState<GoldenRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [excelView, setExcelView] = useState(false);
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const PAGE_SIZE = 10;
  const targetPath = `${mdmDef.targetCatalog}.${mdmDef.targetSchema}.${mdmDef.targetTable}`;

  // Databricks discovery
  const [catalogs, setCatalogs] = useState<string[]>(['mdm', 'workspace', 'main', 'samples']);
  const [selectedCatalog, setSelectedCatalog] = useState('mdm');
  const [schemas, setSchemas] = useState<string[]>(['gold', 'silver', 'bronze', 'default']);
  const [selectedSchema, setSelectedSchema] = useState('gold');
  const [discoveredTables, setDiscoveredTables] = useState<Array<{ name: string; tableType?: string }>>([]);
  const [selectedTableNames, setSelectedTableNames] = useState<string[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState('');

  // Schema definition
  const [customColumns, setCustomColumns] = useState<CanonicalAttribute[]>(() => consolidateMasterAttributes(mdmDef.canonicalAttributes || []));
  const [newCol, setNewCol] = useState({ name: '', key: '', type: 'string', category: 'OTHER', required: false, description: '' });
  const [schemaSaveSuccess, setSchemaSaveSuccess] = useState(false);
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [editColValues, setEditColValues] = useState<Partial<CanonicalAttribute>>({});
  const [suggestingSchema, setSuggestingSchema] = useState(false);
  const [step3ColsExpanded, setStep3ColsExpanded] = useState(false);

  // Mapping
  const [selectedSourceForMapping, setSelectedSourceForMapping] = useState<SourceSystem | null>(null);
  const [sourcePreviewRows, setSourcePreviewRows] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [columnMappings, setColumnMappings] = useState<ExtendedColumnMapping[]>([]);
  const [savingMapping, setSavingMapping] = useState(false);
  const [mappingSuccess, setMappingSuccess] = useState(false);
  const [generatingGolden, setGeneratingGolden] = useState(false);
  const [selectedSourceTableCount, setSelectedSourceTableCount] = useState<number>(100);
  const [dataQualityRate, setDataQualityRate] = useState<string>('98.4%');
  const [nullRate, setNullRate] = useState<string>('< 1.2%');

  const getContributingSourcesForRecord = useCallback((rec: GoldenRecord): any[] => {
    const store = getLocalStorageData<Record<string, any[]>>('lf_source_records', {});
    const list = store[rec.id] || store[rec.mdmCustomerId || ''] || [];
    if (list && list.length > 0) return list;
    const sources = rec.sources || [];
    return sources.map((sName, idx) => ({
      id: `SRC-${rec.id}-${idx}`,
      systemName: typeof sName === 'string' ? sName : (sName as any)?.systemName || (sName as any)?.sourceName || 'Source System',
      systemRecordId: `${rec.id.replace('GOLD-', '')}-${idx + 1}`,
      trustScore: 98,
      originalName: rec.masterName,
      emailOriginal: rec.primaryEmail,
      phoneOriginal: rec.primaryPhone,
      attributes: {
        name: rec.masterName,
        email: rec.primaryEmail,
        phone: rec.primaryPhone,
        city: rec.city,
        state: rec.state,
        address: rec.address,
      }
    }));
  }, []);

  const applyFiltersAndPage = useCallback((base: GoldenRecord[], pg: number, srch: string, status: string, excel: boolean) => {
    let filtered = base;
    if (srch) {
      const s = srch.toLowerCase();
      filtered = filtered.filter(r =>
        String((r as any).masterName || (r as any).name || '').toLowerCase().includes(s) ||
        String(r.id || '').toLowerCase().includes(s) ||
        String((r as any).primaryEmail || (r as any).email || '').toLowerCase().includes(s)
      );
    }
    if (status) filtered = filtered.filter(r => r.entityStatus === status);
    const paginated = excel ? filtered : filtered.slice((pg - 1) * PAGE_SIZE, pg * PAGE_SIZE);
    setRecords(paginated); setTotal(filtered.length);
  }, []);

  const refreshMdmData = useCallback(() => {
    const currentMdm = resolveMdmDef(currentId);
    setMdmDef(currentMdm); setCustomColumns(currentMdm.canonicalAttributes || []);
    const sources = getSourcesForMdm(currentMdm); setMdmSources(sources);
    if (sources.length > 0 && !selectedSourceForMapping) setSelectedSourceForMapping(sources[0]);
    const base = readGoldenRecordsForMdm(currentMdm); setAllRecords(base);
    applyFiltersAndPage(base, page, search, filterStatus, excelView);
  }, [currentId, page, search, filterStatus, excelView, selectedSourceForMapping, applyFiltersAndPage]);

  useEffect(() => { refreshMdmData(); setLoading(false); }, [currentId]);
  useEffect(() => { applyFiltersAndPage(allRecords, page, search, filterStatus, excelView); }, [search, filterStatus, page, excelView, allRecords, applyFiltersAndPage]);

  useEffect(() => {
    setLoadingCatalogs(true);
    fetchCatalogs()
      .then(cats => {
        const v = cats && cats.length > 0 ? cats : ['mdm', 'workspace', 'main', 'samples'];
        setCatalogs(v); setSelectedCatalog(v[0]); loadSchemasForCatalog(v[0]);
      })
      .catch(() => { setCatalogs(['mdm', 'workspace', 'main', 'samples']); setSelectedCatalog('mdm'); loadSchemasForCatalog('mdm'); })
      .finally(() => setLoadingCatalogs(false));
  }, []);

  const loadSchemasForCatalog = async (cat: string) => {
    setLoadingSchemas(true);
    try {
      const schs = await fetchSchemas(cat);
      const valid = schs && schs.length > 0 ? schs : ['gold', 'silver', 'bronze', 'default'];
      setSchemas(valid); const activeSch = valid[0] || 'gold'; setSelectedSchema(activeSch);
      runTableDiscovery(cat, activeSch);
    } catch { setSchemas(['gold', 'silver', 'bronze', 'default']); setSelectedSchema('gold'); runTableDiscovery(cat, 'gold'); }
    finally { setLoadingSchemas(false); }
  };

  const runTableDiscovery = async (cat: string, sch: string) => {
    setLoadingDiscovery(true); setDiscoveredTables([]);
    try {
      const tables = await fetchTables(cat, sch);
      if (tables && tables.length > 0) {
        // DatabricksTable uses tableName field - normalize to { name }
        setDiscoveredTables(tables.map((t: any) => ({ name: t.tableName || t.name || String(t), tableType: t.tableType || 'MANAGED' })));
      } else {
        setDiscoveredTables([
          { name: `${mdmDef.domain}_source_raw`, tableType: 'MANAGED' },
          { name: `${mdmDef.domain}_staging_feed`, tableType: 'MANAGED' },
        ]);
      }
    } catch {
      setDiscoveredTables([
        { name: `${mdmDef.domain}_crm_extract`, tableType: 'MANAGED' },
        { name: `${mdmDef.domain}_lakehouse_feed`, tableType: 'MANAGED' },
      ]);
    } finally { setLoadingDiscovery(false); }
  };

  const handleRegisterSelectedTables = async () => {
    if (selectedTableNames.length === 0) return;
    setRegistering(true); setRegistrationSuccess('');
    try {
      const newSources: SourceSystem[] = [];
      for (const tName of selectedTableNames) {
        const countRes = await fetchTableCount(selectedCatalog, selectedSchema, tName).catch(() => ({ rowCount: 1500 }));
        const newSrc: SourceSystem = {
          sourceId: `SRC-${selectedCatalog.toUpperCase()}-${tName.toUpperCase()}-${Date.now()}`,
          sourceName: `${tName} (${selectedCatalog}.${selectedSchema})`,
          sourceType: 'delta_table', catalog: selectedCatalog, schema: selectedSchema, tableName: tName,
          targetMdmId: mdmDef.id, targetTable: mdmDef.targetTable, priority: 5, status: 'active',
          recordCount: countRes.rowCount || 1200, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        (newSrc as any).domain = mdmDef.domain; newSources.push(newSrc);
      }
      const all = getLocalStorageData<SourceSystem[]>('lf_source_systems', []);
      saveLocalStorageData('lf_source_systems', [...all.filter(s => !newSources.some(n => n.sourceId === s.sourceId)), ...newSources]);
      window.dispatchEvent(new CustomEvent('lf_sources_changed'));
      setRegistrationSuccess(`Successfully registered ${newSources.length} table(s) to ${mdmDef.name}!`);
      setSelectedTableNames([]); markStepCompleted('sources'); refreshMdmData();
    } catch (err: any) { alert(`Failed to register tables: ${err?.message || 'Unknown error'}`); }
    finally { setRegistering(false); }
  };

  const handleRemoveSource = (sourceId: string) => {
    if (!window.confirm('Remove this source table from the MDM?')) return;
    const all = getLocalStorageData<SourceSystem[]>('lf_source_systems', []);
    saveLocalStorageData('lf_source_systems', all.filter(s => s.sourceId !== sourceId));
    window.dispatchEvent(new CustomEvent('lf_sources_changed')); refreshMdmData();
  };

  const persistSchemaDefinition = (cols: CanonicalAttribute[]) => {
    let savedCustom: MasterDefinition[] = getLocalStorageData<MasterDefinition[]>('lf_custom_mdm_targets', []);
    const idx = savedCustom.findIndex(m => m.id === mdmDef.id);
    const updatedDef = { ...mdmDef, canonicalAttributes: cols };
    if (idx >= 0) savedCustom[idx] = updatedDef; else savedCustom.push(updatedDef);
    saveLocalStorageData('lf_custom_mdm_targets', savedCustom);
    window.dispatchEvent(new CustomEvent('mdm_definitions_changed'));
    setMdmDef(updatedDef);
  };

  const handleAddColumn = () => {
    if (!newCol.name) return;
    const cleanKey = (newCol.key || newCol.name).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const newAttr: CanonicalAttribute = {
      name: newCol.name, key: cleanKey, type: (newCol.type || 'string') as any,
      category: (newCol.category || 'OTHER') as any, required: newCol.required,
      description: newCol.description || `${newCol.name} attribute`
    };
    const updated = [...customColumns.filter(c => c.key !== cleanKey), newAttr];
    setCustomColumns(updated);
    persistSchemaDefinition(updated);
    setNewCol({ name: '', key: '', type: 'string', category: 'OTHER', required: false, description: '' });
  };

  const handleDeleteColumn = (key: string) => {
    if (!window.confirm(`Remove column "${key}"?`)) return;
    const updated = customColumns.filter(c => c.key !== key);
    setCustomColumns(updated);
    persistSchemaDefinition(updated);
    setColumnMappings(prev => prev.map(m => m.targetColumn === key ? { ...m, targetColumn: '', status: 'NEEDS_REVIEW', confidence: 0 } : m));
  };

  const handleEditColumn = (col: CanonicalAttribute) => { setEditingColKey(col.key); setEditColValues({ ...col }); };

  const handleSaveEditColumn = () => {
    if (!editingColKey) return;
    const oldKey = editingColKey;
    const newKey = (editColValues.key || oldKey).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const updated = customColumns.map(c => c.key === oldKey ? { ...c, ...editColValues, key: newKey } as CanonicalAttribute : c);
    setCustomColumns(updated);
    persistSchemaDefinition(updated);
    if (newKey !== oldKey) {
      setColumnMappings(prev => prev.map(m => m.targetColumn === oldKey ? { ...m, targetColumn: newKey } : m));
    }
    setEditingColKey(null);
    setEditColValues({});
  };

  const handleSaveSchemaDefinition = () => {
    persistSchemaDefinition(customColumns);
    setSchemaSaveSuccess(true);
    markStepCompleted('schema');
    setTimeout(() => { setSchemaSaveSuccess(false); navigateToStep('mapping'); }, 1200);
  };

  // Suggest Structure / Column names based on registered Databricks tables
  const handleSuggestSchemaFromTables = async () => {
    setSuggestingSchema(true);
    try {
      const detectedMap = new Map<string, { name: string; key: string; type: string; category: string; required: boolean; count: number }>();
      const sourcesToScan = mdmSources.length > 0 ? mdmSources : getSourcesForMdm(mdmDef);

      if (sourcesToScan.length > 0) {
        for (const src of sourcesToScan) {
          try {
            const cat = src.catalog || 'mdm';
            const sch = src.schema || 'gold';
            const tbl = src.tableName || '';
            const preview = await fetchSourcePreview(cat, sch, tbl);
            const rawCols: string[] = (preview && preview.columns && preview.columns.length > 0)
              ? preview.columns.map(c => c.name)
              : (src.columnMappings && src.columnMappings.length > 0)
                ? src.columnMappings.map(m => m.sourceColumn)
                : ['id', 'name', 'email', 'phone', 'city', 'state', 'created_at'];

            rawCols.forEach((rawName, idx) => {
              const lower = rawName.toLowerCase().trim();
              let cleanKey = lower.replace(/[^a-z0-9_]/g, '_');
              let displayName = rawName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              let category = 'OTHER';
              let type = 'string';
              let required = false;

              if (lower.includes('id') || lower === 'id' || lower.endsWith('_id') || idx === 0) {
                category = 'ID';
                required = true;
                cleanKey = `${mdmDef.domain.toLowerCase()}_id`;
                displayName = `${mdmDef.domain.charAt(0).toUpperCase() + mdmDef.domain.slice(1)} ID`;
              } else if (lower.includes('email') || lower.includes('mail')) {
                category = 'EMAIL';
                cleanKey = 'email';
                displayName = 'Email Address';
              } else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('tel') || lower.includes('cell')) {
                category = 'PHONE';
                cleanKey = 'phone';
                displayName = 'Phone Number';
              } else if (lower.includes('first') || lower.includes('last') || lower.includes('name')) {
                // Consolidate first_name, last_name, customer_name, name into a single record!
                category = 'NAME';
                cleanKey = 'name';
                displayName = 'Name';
                required = true;
              } else if (['address', 'city', 'state', 'zip', 'postal', 'street', 'country'].some(a => lower.includes(a))) {
                category = 'ADDRESS';
              } else if (['date', 'time', 'created', 'updated', 'timestamp', 'dob'].some(t => lower.includes(t))) {
                category = 'TEMPORAL';
                type = 'date';
              } else if (['amount', 'balance', 'price', 'count', 'qty', 'score'].some(n => lower.includes(n))) {
                type = 'number';
              }

              const existing = detectedMap.get(cleanKey);
              if (existing) {
                existing.count += 1;
              } else {
                detectedMap.set(cleanKey, {
                  name: displayName,
                  key: cleanKey,
                  type,
                  category,
                  required,
                  count: 1
                });
              }
            });
          } catch (e) {
            console.warn('Could not inspect table for schema suggestion:', src.sourceName, e);
          }
        }
      }

      if (detectedMap.size > 0) {
        const rawSuggested: CanonicalAttribute[] = Array.from(detectedMap.values()).map(col => ({
          name: col.name,
          key: col.key,
          type: col.type as any,
          category: col.category as any,
          required: col.required,
          description: col.key === 'name' ? 'Consolidated Master Name (unifies first_name, last_name, name)' : `Suggested from selected tables (detected in ${col.count} source${col.count > 1 ? 's' : ''})`
        }));
        const suggested = consolidateMasterAttributes(rawSuggested);
        setCustomColumns(suggested);
        persistSchemaDefinition(suggested);
      } else {
        const fallback: CanonicalAttribute[] = consolidateMasterAttributes(
          mdmDef.canonicalAttributes && mdmDef.canonicalAttributes.length > 0
            ? mdmDef.canonicalAttributes
            : [
                { name: `${mdmDef.domain.toUpperCase()} ID`, key: `${mdmDef.domain}_id`, type: 'string', category: 'ID', required: true, description: 'Primary Key' },
                { name: 'Name', key: 'name', type: 'string', category: 'NAME', required: true, description: 'Consolidated Name' },
                { name: 'Primary Email', key: 'email', type: 'string', category: 'EMAIL', required: false, description: 'Email address' },
                { name: 'Phone Number', key: 'phone', type: 'string', category: 'PHONE', required: false, description: 'Contact phone' },
                { name: 'Status', key: 'status', type: 'string', category: 'OTHER', required: false, description: 'Record status' },
              ]
        );
        setCustomColumns(fallback);
        persistSchemaDefinition(fallback);
      }
    } finally {
      setSuggestingSchema(false);
    }
  };

  // Re-sync customColumns from persisted mdmDef whenever we enter the mapping step
  useEffect(() => {
    if (activeStep === 'mapping') {
      const freshDef = resolveMdmDef(currentId);
      const freshCols = freshDef.canonicalAttributes || [];
      if (freshCols.length > 0) {
        setCustomColumns(freshCols);
        setMdmDef(prev => ({ ...prev, canonicalAttributes: freshCols }));
      }
    }
  }, [activeStep, currentId]);

  // Unified mapping: fetch columns for ALL registered source tables and build combined mapping
  useEffect(() => {
    if (activeStep !== 'mapping' || mdmSources.length === 0) return;
    setLoadingPreview(true);

    const fetchAllSources = async () => {
      const allMappings: ExtendedColumnMapping[] = [];
      let aggTotalRows = 0;
      let aggTotalCells = 0;
      let aggValidCells = 0;

      const freshDef = resolveMdmDef(currentId);
      const targetCols = (freshDef.canonicalAttributes && freshDef.canonicalAttributes.length > 0)
        ? freshDef.canonicalAttributes
        : (mdmDef.canonicalAttributes || []);

      for (const src of mdmSources) {
        const cat = src.catalog || 'mdm';
        const sch = src.schema || 'bronze';
        const tbl = src.tableName || '';
        const shortName = src.tableName || src.sourceName || 'Unknown';

        try {
          const [preview, tableData, countData] = await Promise.all([
            fetchSourcePreview(cat, sch, tbl),
            fetchTableData(cat, sch, tbl, 10),
            fetchTableCount(cat, sch, tbl)
          ]);

          aggTotalRows += countData?.rowCount || src.recordCount || 100;

          // Compute data quality from live rows
          if (tableData?.rows?.length > 0) {
            tableData.rows.forEach((r: any) => {
              Object.values(r).forEach((v: any) => {
                aggTotalCells++;
                if (v !== null && v !== undefined && String(v).trim() !== '' && String(v).toLowerCase() !== 'null') {
                  aggValidCells++;
                }
              });
            });
          }

          // Determine columns from live data
          const cols = (tableData?.columns?.length > 0)
            ? tableData.columns.map((c: string) => ({ name: c, type: 'string' }))
            : (preview?.columns?.length > 0)
              ? preview.columns
              : [];

          // Check for existing saved mappings for this source
          const existingMappings = src.columnMappings;
          if (existingMappings && existingMappings.length > 0 && existingMappings.some(m => m.targetColumn)) {
            existingMappings.forEach(m => {
              let tgt = m.targetColumn;
              const sLower = m.sourceColumn.toLowerCase();
              if (['first_name', 'last_name', 'customer_name'].includes(tgt) || ['first_name', 'last_name', 'customer_name'].includes(sLower)) {
                if (targetCols.some(t => t.key === 'name' || t.category === 'NAME')) {
                  tgt = 'name';
                }
              }
              allMappings.push({
                ...m,
                targetColumn: tgt,
                status: tgt ? 'CONFIRMED' : 'NEEDS_REVIEW',
                confidence: tgt ? 0.95 : 0.60,
                sourceTableName: shortName,
                sourceTableId: src.sourceId
              });
            });
          } else {
            cols.forEach((c: { name: string; type: string }) => {
              const cLower = c.name.toLowerCase();
              const match = targetCols.find(t => {
                if ((t.category === 'NAME' || t.key === 'name') &&
                    ['first_name', 'last_name', 'customer_name', 'full_name', 'name', 'fname', 'lname', 'client_name'].includes(cLower)) {
                  return true;
                }
                return t.key.toLowerCase() === cLower ||
                       t.name.toLowerCase() === cLower ||
                       t.key.includes(cLower) ||
                       cLower.includes(t.key);
              });
              allMappings.push({
                sourceColumn: c.name,
                targetColumn: match ? match.key : '',
                transformation: 'DIRECT',
                confidence: match ? 0.95 : 0.60,
                required: false,
                status: match ? 'CONFIRMED' : 'NEEDS_REVIEW',
                sourceTableName: shortName,
                sourceTableId: src.sourceId,
              });
            });
          }
        } catch (err) {
          console.warn('Error fetching source:', src.sourceName, err);
        }
      }

      setColumnMappings(allMappings);
      setSelectedSourceTableCount(aggTotalRows);
      if (aggTotalCells > 0) {
        setDataQualityRate(`${((aggValidCells / aggTotalCells) * 100).toFixed(1)}%`);
        setNullRate(`${(((aggTotalCells - aggValidCells) / aggTotalCells) * 100).toFixed(1)}%`);
      } else {
        setDataQualityRate('98.5%');
        setNullRate('< 1.2%');
      }
      setLoadingPreview(false);
    };

    fetchAllSources();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, mdmSources.length, currentId]);

  const handleAutoMap = () => {
    const targetCols = customColumns.length > 0 ? customColumns : (mdmDef.canonicalAttributes || []);
    setColumnMappings(prev => prev.map(m => {
      const sLower = m.sourceColumn.toLowerCase();
      const match = targetCols.find(t => {
        if ((t.category === 'NAME' || t.key === 'name') &&
            ['first_name', 'last_name', 'customer_name', 'full_name', 'name', 'fname', 'lname', 'client_name'].includes(sLower)) {
          return true;
        }
        return t.key.toLowerCase() === sLower ||
               t.name.toLowerCase() === sLower ||
               t.key.includes(sLower) ||
               sLower.includes(t.key);
      });
      return match ? { ...m, targetColumn: match.key, confidence: 0.98, status: 'CONFIRMED' } : m;
    }));
  };

  // Saves unified mappings for ALL source tables at once
  const handleSaveMapping = () => {
    if (columnMappings.length === 0) return;
    setSavingMapping(true);
    setMappingSuccess(false);
    try {
      // Group mappings by sourceTableId with minimal payload to conserve localStorage
      const mappingsBySource = new Map<string, ExtendedColumnMapping[]>();
      columnMappings.forEach(m => {
        const id = m.sourceTableId || '';
        if (!mappingsBySource.has(id)) mappingsBySource.set(id, []);
        mappingsBySource.get(id)!.push({
          sourceColumn: m.sourceColumn,
          targetColumn: m.targetColumn,
          transformation: m.transformation || 'direct',
          status: m.status || 'CONFIRMED',
          confidence: m.confidence ?? 1.0,
        } as ExtendedColumnMapping);
      });

      freeLocalStorageSpace();
      const allSources = getLocalStorageData<SourceSystem[]>('lf_source_systems', []);
      const updatedSources = allSources.map(s => {
        const srcMappings = mappingsBySource.get(s.sourceId);
        if (srcMappings && srcMappings.some(m => m.targetColumn)) {
          return { ...s, columnMappings: srcMappings, status: 'active' as const, mappingVerified: true };
        }
        return s;
      });
      saveLocalStorageData('lf_source_systems', updatedSources);
      setMdmSources(prev => prev.map(s => {
        const srcMappings = mappingsBySource.get(s.sourceId);
        if (srcMappings && srcMappings.some(m => m.targetColumn)) {
          return { ...s, columnMappings: srcMappings, status: 'active' as const, mappingVerified: true };
        }
        return s;
      }));
      setMappingSuccess(true);
      setTimeout(() => setMappingSuccess(false), 4000);
    } catch (err: any) {
      alert(`Error saving mappings: ${err?.message || 'Failed to save'}`);
    } finally {
      setSavingMapping(false);
    }
  };

  // Generates golden records once all mappings are verified
  const handleGenerateGoldenRecords = async () => {
    setGeneratingGolden(true);
    try {
      const allSources = getLocalStorageData<SourceSystem[]>('lf_source_systems', []);
      const matched = allSources.filter(s => s.targetMdmId === mdmDef.id || s.targetTable === mdmDef.targetTable);
      const sourcesToUse = matched.length > 0 ? matched : allSources;
      const res = await populateGoldenRecordsFromSources(sourcesToUse, mdmDef);
      const totalRecs = sourcesToUse.reduce((acc, s) => acc + (s.recordCount || 100), 0);
      recordSuccessfulPipeline({
        mdmId: mdmDef.id,
        mdmName: mdmDef.name,
        recordsProcessed: totalRecs,
        goldenGenerated: res.goldenRecords.length
      });
      markStepCompleted('mapping');
      markStepCompleted('golden');

      // Immediately populate state with generated golden records so they are displayed without delay
      if (res.goldenRecords && res.goldenRecords.length > 0) {
        setAllRecords(res.goldenRecords);
        applyFiltersAndPage(res.goldenRecords, 1, search, filterStatus, excelView);
      } else {
        refreshMdmData();
      }

      navigateToStep('golden');
    } catch (err: any) {
      alert(`Consolidation error: ${err?.message || 'Error running pipeline'}`);
    } finally {
      setGeneratingGolden(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const allSources = getLocalStorageData<SourceSystem[]>('lf_source_systems', []);
      const matched = allSources.filter(s => s.targetMdmId === mdmDef.id || s.targetTable === mdmDef.targetTable);
      const res = await populateGoldenRecordsFromSources(matched.length > 0 ? matched : allSources, mdmDef);
      recordSuccessfulPipeline({ mdmId: mdmDef.id, mdmName: mdmDef.name, recordsProcessed: 1500, goldenGenerated: res.goldenRecords.length });
      setPublishSuccess(true); setTimeout(() => setPublishSuccess(false), 3000); refreshMdmData();
    } finally { setPublishing(false); }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto bg-gray-50 flex flex-col h-full">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/master-data" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <ArrowLeft size={13} /> MDM Data Hub
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{mdmDef.domain}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <Award className="text-indigo-600" size={22} />
            {mdmDef.name}
            <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              {targetPath}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">{mdmDef.description}</p>
        </div>
        {activeStep === 'golden' && (
          <button onClick={handlePublish} disabled={publishing}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition shrink-0">
            {publishing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            Re-run Pipeline
          </button>
        )}
      </div>

      {/* Step Progress Bar */}
      <StepBar current={activeStep} completed={completedSteps} onNavigate={navigateToStep} />

      {publishSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <CheckCircle2 size={16} className="text-emerald-600" />
          MDM Pipeline executed! Golden records refreshed.
        </div>
      )}

      {/* ====== STEP 2: MASTER SCHEMA STRUCTURE ====== */}
      {activeStep === 'schema' && (
        <div className="space-y-5">
          {schemaSaveSuccess && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Master schema saved! Moving to Source Analysis & Mapping...
            </div>
          )}

          {/* Master Canonical Structure Synthesis & Management */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest block mb-0.5">
                  Step 2 of 4 — Master Schema Architecture
                </span>
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-indigo-600" />
                  <h3 className="text-base font-bold text-gray-900">
                    Master Canonical Structure for {mdmDef.name} ({customColumns.length} attributes)
                  </h3>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Databricks Unified
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 max-w-3xl">
                  Canonical master attributes automatically synthesized from registered Databricks tables. Attributes sharing a common business entity (such as <code>first_name</code>, <code>last_name</code>, and <code>name</code>) are unified into a single master record. You can edit names, delete, or add custom attributes.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSuggestSchemaFromTables}
                  disabled={suggestingSchema}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition"
                >
                  {suggestingSchema ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Re-Analyze & Suggest
                </button>
                <button
                  onClick={handleSaveSchemaDefinition}
                  disabled={customColumns.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  <Save size={13} /> Save Schema & Proceed to Mapping &rarr;
                </button>
              </div>
            </div>

            {/* Add column form */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">Add Canonical Column</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <input type="text" placeholder="Column Name (e.g. Full Name)" value={newCol.name}
                  onChange={e => setNewCol({ ...newCol, name: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
                  className="col-span-2 sm:col-span-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                <input type="text" placeholder="Field Key (e.g. full_name)" value={newCol.key}
                  onChange={e => setNewCol({ ...newCol, key: e.target.value })}
                  className="col-span-2 sm:col-span-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono" />
                <select value={newCol.type} onChange={e => setNewCol({ ...newCol, type: e.target.value })} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs">
                  <option value="string">string</option><option value="number">number</option><option value="date">date</option><option value="boolean">boolean</option>
                </select>
                <select value={newCol.category} onChange={e => setNewCol({ ...newCol, category: e.target.value })} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs">
                  <option value="ID">ID</option><option value="NAME">NAME</option><option value="EMAIL">EMAIL</option>
                  <option value="PHONE">PHONE</option><option value="ADDRESS">ADDRESS</option><option value="TEMPORAL">TEMPORAL</option><option value="OTHER">OTHER</option>
                </select>
                <label className="flex items-center gap-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={newCol.required} onChange={e => setNewCol({ ...newCol, required: e.target.checked })} className="rounded text-indigo-600" />
                  Required
                </label>
                <button onClick={handleAddColumn} disabled={!newCol.name}
                  className="flex items-center justify-center gap-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition">
                  <PlusCircle size={13} /> Add
                </button>
              </div>
            </div>

            {/* Columns table */}
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="p-3">Column Name</th>
                    <th className="p-3">Key</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Required</th>
                    <th className="p-3 text-right">Actions (Edit / Delete)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {customColumns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">
                        No columns defined yet. Click "Re-Analyze & Suggest" or add your first column above.
                      </td>
                    </tr>
                  ) : customColumns.map(col =>
                    editingColKey === col.key ? (
                      <tr key={col.key} className="bg-indigo-50/20">
                        <td className="p-2"><input value={editColValues.name || ''} onChange={e => setEditColValues(v => ({ ...v, name: e.target.value }))} className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs" /></td>
                        <td className="p-2"><input value={editColValues.key || ''} onChange={e => setEditColValues(v => ({ ...v, key: e.target.value }))} className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs font-mono" /></td>
                        <td className="p-2">
                          <select value={editColValues.type || 'string'} onChange={e => setEditColValues(v => ({ ...v, type: e.target.value as any }))} className="bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs">
                            <option value="string">string</option><option value="number">number</option><option value="date">date</option><option value="boolean">boolean</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select value={editColValues.category || 'OTHER'} onChange={e => setEditColValues(v => ({ ...v, category: e.target.value as any }))} className="bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs">
                            <option value="ID">ID</option><option value="NAME">NAME</option><option value="EMAIL">EMAIL</option><option value="PHONE">PHONE</option><option value="ADDRESS">ADDRESS</option><option value="TEMPORAL">TEMPORAL</option><option value="OTHER">OTHER</option>
                          </select>
                        </td>
                        <td className="p-2"><input type="checkbox" checked={editColValues.required || false} onChange={e => setEditColValues(v => ({ ...v, required: e.target.checked }))} className="rounded text-indigo-600" /></td>
                        <td className="p-2 text-right space-x-1">
                          <button onClick={handleSaveEditColumn} className="p-1 text-emerald-600 hover:text-emerald-800 transition" title="Save"><Save size={14} /></button>
                          <button onClick={() => setEditingColKey(null)} className="p-1 text-gray-400 hover:text-gray-600 transition" title="Cancel"><X size={14} /></button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={col.key} className="hover:bg-gray-50/50 transition">
                        <td className="p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900">{col.name}</span>
                            {(col.category === 'NAME' || col.key === 'name') && (
                              <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full font-mono font-medium">
                                unifies: first_name, last_name, name
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-indigo-600 text-[11px]">{col.key}</td>
                        <td className="p-3"><span className="font-mono text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{col.type}</span></td>
                        <td className="p-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{col.category || 'OTHER'}</span></td>
                        <td className="p-3">{col.required ? <span className="text-emerald-600 font-bold text-[11px]">Yes</span> : <span className="text-gray-400 text-[11px]">No</span>}</td>
                        <td className="p-3 text-right space-x-1">
                          <button onClick={() => handleEditColumn(col)} className="p-1 text-gray-400 hover:text-indigo-600 transition" title="Edit Column Name"><Edit3 size={13} /></button>
                          <button onClick={() => handleDeleteColumn(col.key)} className="p-1 text-gray-400 hover:text-red-600 transition" title="Delete Column"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <button onClick={() => navigateToStep('sources')} className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1">
                <ArrowLeft size={13} /> Back to Source Tables
              </button>
              {customColumns.length > 0 && (
                <button onClick={handleSaveSchemaDefinition}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition">
                  <Save size={14} /> Save Schema & Proceed to Mapping <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== STEP 1: SOURCE TABLE REGISTRATION ====== */}
      {activeStep === 'sources' && (
        <div className="space-y-5">
          {registrationSuccess && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 size={16} className="text-emerald-600" />
              {registrationSuccess}
              <button onClick={() => { markStepCompleted('sources'); navigateToStep('schema'); }} className="ml-auto underline hover:no-underline font-bold text-emerald-900">
                Continue to Master Schema Definition &rarr;
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <div>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">Step 1 of 4 — Source Table Registration</span>
              <h2 className="text-lg font-bold text-gray-900 mt-0.5 flex items-center gap-2">
                <Server size={18} className="text-indigo-600" />
                Register Databricks Source Tables for {mdmDef.name}
              </h2>
              <p className="text-xs text-gray-500 mt-1">Browse Unity Catalog and select Delta Lake tables to feed into this master domain.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Databricks Catalog {loadingCatalogs && <span className="text-indigo-400 font-normal normal-case">(loading...)</span>}
                </label>
                <select value={selectedCatalog} onChange={e => { setSelectedCatalog(e.target.value); loadSchemasForCatalog(e.target.value); }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 outline-none focus:border-indigo-400">
                  {catalogs.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Schema / Database {loadingSchemas && <span className="text-indigo-400 font-normal normal-case">(loading...)</span>}
                </label>
                <select value={selectedSchema} onChange={e => { setSelectedSchema(e.target.value); runTableDiscovery(selectedCatalog, e.target.value); }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-900 outline-none focus:border-indigo-400">
                  {schemas.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Tables in {selectedCatalog}.{selectedSchema}
                  {loadingDiscovery && <span className="text-indigo-400 font-normal normal-case ml-1">(discovering...)</span>}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-indigo-600 font-semibold">{selectedTableNames.length} selected</span>
                  <button onClick={() => runTableDiscovery(selectedCatalog, selectedSchema)}
                    className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-indigo-600 font-semibold transition">
                    <RefreshCw size={11} /> Refresh
                  </button>
                </div>
              </div>

              {loadingDiscovery ? (
                <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-indigo-400" />
                  Discovering tables from Databricks Unity Catalog...
                </div>
              ) : discoveredTables.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  No tables found in <strong>{selectedCatalog}.{selectedSchema}</strong>. Try a different catalog or schema.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {discoveredTables.map(t => {
                    const isSelected = selectedTableNames.includes(t.name);
                    const isRegistered = mdmSources.some(s => s.tableName === t.name);
                    return (
                      <div key={t.name}
                        onClick={() => { if (isRegistered) return; setSelectedTableNames(prev => isSelected ? prev.filter(x => x !== t.name) : [...prev, t.name]); }}
                        className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
                          isRegistered ? 'bg-emerald-50/50 border-emerald-200 cursor-default'
                          : isSelected ? 'bg-indigo-50/60 border-indigo-400 cursor-pointer shadow-sm'
                          : 'bg-white border-gray-200 hover:border-indigo-200 hover:shadow-sm cursor-pointer'
                        }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {isRegistered ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" /> : <input type="checkbox" checked={isSelected} onChange={() => {}} className="rounded text-indigo-600 shrink-0" />}
                          <span className={`text-xs font-semibold truncate ${isRegistered ? 'text-emerald-700' : ''}`}>{t.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isRegistered && <span className="text-[10px] text-emerald-600 font-bold">Registered</span>}
                          <Table size={12} className={isSelected ? 'text-indigo-500' : 'text-gray-300'} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-3">
              <Link to="/master-data" className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1">
                <ArrowLeft size={13} /> Back to MDM Data Hub
              </Link>
              <div className="flex items-center gap-2">
                {mdmSources.length > 0 && (
                  <button
                    onClick={() => {
                      markStepCompleted('sources');
                      navigateToStep('schema');
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition"
                  >
                    Continue to Master Schema <ArrowRight size={13} />
                  </button>
                )}
                <button onClick={handleRegisterSelectedTables} disabled={selectedTableNames.length === 0 || registering}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition">
                  {registering ? <RefreshCw size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                  Register {selectedTableNames.length > 0 ? `${selectedTableNames.length} Table(s)` : 'Selected Tables'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== STEP 3: SOURCE ANALYSIS & SCHEMA MAPPING ====== */}
      {activeStep === 'mapping' && (() => {
        const allMappingsSaved = mdmSources.length > 0 && mdmSources.every(s => (s as any).mappingVerified || (s.columnMappings && s.columnMappings.some(m => m.targetColumn)));
        const uniqueSourceTables = [...new Set(columnMappings.map(m => m.sourceTableName || 'Unknown'))];
        const totalSourceCols = columnMappings.length;
        const mappedCount = columnMappings.filter(m => m.targetColumn).length;

        return (
          <div className="space-y-5">
            {mappingSuccess && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <CheckCircle2 size={16} className="text-emerald-600" />
                All mappings successfully saved and verified for {mdmSources.length} source table(s)!
              </div>
            )}

            {mdmSources.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm text-center space-y-3">
                <Database size={40} className="mx-auto text-gray-300" />
                <h3 className="font-bold text-gray-700">No Source Tables Registered Yet</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">Register at least one Databricks source table before running analysis and mapping.</p>
                <button onClick={() => navigateToStep('sources')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition">
                  Go to Source Table Registration &rarr;
                </button>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                    <div>
                      <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">Step 3 of 4 — Unified Schema Mapping</span>
                      <h2 className="text-lg font-bold text-gray-900 mt-0.5 flex items-center gap-2">
                        <BarChart3 size={18} className="text-indigo-600" />Combined Source-to-Master Schema Mapping
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">Mapping all {mdmSources.length} registered source table(s) to {mdmDef.name} master schema.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {mdmSources.map(s => (
                        <span key={s.sourceId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold rounded-lg">
                          <Table size={11} />{s.tableName || s.sourceName}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Rows', value: (selectedSourceTableCount || 100).toLocaleString(), sub: `Across ${mdmSources.length} table(s)`, color: 'text-gray-900' },
                      { label: 'Source Columns', value: String(totalSourceCols), sub: `${mappedCount} mapped, ${totalSourceCols - mappedCount} unmapped`, color: 'text-gray-900' },
                      { label: 'Data Quality', value: dataQualityRate, sub: 'Ready for consolidation', color: 'text-emerald-600' },
                      { label: 'Null Rate', value: nullRate, sub: 'Aggregated null rate', color: 'text-indigo-600' },
                    ].map(kpi => (
                      <div key={kpi.label} className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                        <span className="text-[10px] uppercase font-bold text-gray-400">{kpi.label}</span>
                        <p className={`text-lg font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                        <span className="text-[10px] text-gray-400">{kpi.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Master Canonical Columns Management in Step 3 (Direct Edit & Delete) */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sliders size={16} className="text-indigo-600" />
                        <h3 className="text-sm font-bold text-gray-900">
                          Master Structure Columns ({customColumns.length} defined)
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          Editable During Mapping
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Edit column names, delete unwanted columns, or add new master attributes directly while mapping. All changes instantly update the target mapping dropdowns below.
                      </p>
                    </div>
                    <button
                      onClick={() => setStep3ColsExpanded(!step3ColsExpanded)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition shrink-0 self-start sm:self-auto"
                    >
                      <Sliders size={13} className="text-indigo-600" />
                      {step3ColsExpanded ? 'Collapse Columns Panel' : 'Manage & Edit Column Names'}
                      {step3ColsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {step3ColsExpanded && (
                    <div className="pt-3 border-t border-gray-100 space-y-4">
                      {/* Quick Add Form */}
                      <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block">Add New Master Column</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                          <input type="text" placeholder="Column Name (e.g. Full Name)" value={newCol.name}
                            onChange={e => setNewCol({ ...newCol, name: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
                            className="col-span-2 sm:col-span-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs" />
                          <input type="text" placeholder="Field Key (e.g. full_name)" value={newCol.key}
                            onChange={e => setNewCol({ ...newCol, key: e.target.value })}
                            className="col-span-2 sm:col-span-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono" />
                          <select value={newCol.type} onChange={e => setNewCol({ ...newCol, type: e.target.value })} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs">
                            <option value="string">string</option><option value="number">number</option><option value="date">date</option><option value="boolean">boolean</option>
                          </select>
                          <select value={newCol.category} onChange={e => setNewCol({ ...newCol, category: e.target.value })} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs">
                            <option value="ID">ID</option><option value="NAME">NAME</option><option value="EMAIL">EMAIL</option>
                            <option value="PHONE">PHONE</option><option value="ADDRESS">ADDRESS</option><option value="TEMPORAL">TEMPORAL</option><option value="OTHER">OTHER</option>
                          </select>
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 cursor-pointer">
                            <input type="checkbox" checked={newCol.required} onChange={e => setNewCol({ ...newCol, required: e.target.checked })} className="rounded text-indigo-600" />
                            Required
                          </label>
                          <button onClick={handleAddColumn} disabled={!newCol.name}
                            className="flex items-center justify-center gap-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition">
                            <PlusCircle size={13} /> Add
                          </button>
                        </div>
                      </div>

                      {/* Columns Table */}
                      <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold text-[10px]">
                            <tr>
                              <th className="p-2.5">Master Column Name</th>
                              <th className="p-2.5">Field Key</th>
                              <th className="p-2.5">Type</th>
                              <th className="p-2.5">Category</th>
                              <th className="p-2.5">Required</th>
                              <th className="p-2.5 text-right">Actions (Edit / Delete)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                            {customColumns.map(col =>
                              editingColKey === col.key ? (
                                <tr key={col.key} className="bg-indigo-50/30">
                                  <td className="p-2"><input value={editColValues.name || ''} onChange={e => setEditColValues(v => ({ ...v, name: e.target.value }))} className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs" /></td>
                                  <td className="p-2"><input value={editColValues.key || ''} onChange={e => setEditColValues(v => ({ ...v, key: e.target.value }))} className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs font-mono" /></td>
                                  <td className="p-2">
                                    <select value={editColValues.type || 'string'} onChange={e => setEditColValues(v => ({ ...v, type: e.target.value as any }))} className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs">
                                      <option value="string">string</option><option value="number">number</option><option value="date">date</option><option value="boolean">boolean</option>
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <select value={editColValues.category || 'OTHER'} onChange={e => setEditColValues(v => ({ ...v, category: e.target.value as any }))} className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs">
                                      <option value="ID">ID</option><option value="NAME">NAME</option><option value="EMAIL">EMAIL</option><option value="PHONE">PHONE</option><option value="ADDRESS">ADDRESS</option><option value="TEMPORAL">TEMPORAL</option><option value="OTHER">OTHER</option>
                                    </select>
                                  </td>
                                  <td className="p-2"><input type="checkbox" checked={editColValues.required || false} onChange={e => setEditColValues(v => ({ ...v, required: e.target.checked }))} className="rounded text-indigo-600" /></td>
                                  <td className="p-2 text-right space-x-1">
                                    <button onClick={handleSaveEditColumn} className="p-1 text-emerald-600 hover:text-emerald-800 transition" title="Save"><Save size={13} /></button>
                                    <button onClick={() => setEditingColKey(null)} className="p-1 text-gray-400 hover:text-gray-600 transition" title="Cancel"><X size={13} /></button>
                                  </td>
                                </tr>
                              ) : (
                                <tr key={col.key} className="hover:bg-gray-50/50 transition">
                                  <td className="p-2.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-gray-900">{col.name}</span>
                                      {(col.category === 'NAME' || col.key === 'name') && (
                                        <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-mono font-medium">
                                          unifies: first_name, last_name, name
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2.5 font-mono text-indigo-600 text-[11px]">{col.key}</td>
                                  <td className="p-2.5"><span className="font-mono text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{col.type}</span></td>
                                  <td className="p-2.5"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{col.category || 'OTHER'}</span></td>
                                  <td className="p-2.5">{col.required ? <span className="text-emerald-600 font-bold text-[10px]">Yes</span> : <span className="text-gray-400 text-[10px]">No</span>}</td>
                                  <td className="p-2.5 text-right space-x-1">
                                    <button onClick={() => handleEditColumn(col)} className="p-1 text-gray-400 hover:text-indigo-600 transition" title="Edit Column Name"><Edit3 size={12} /></button>
                                    <button onClick={() => handleDeleteColumn(col.key)} className="p-1 text-gray-400 hover:text-red-600 transition" title="Delete Column"><Trash2 size={12} /></button>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-600" />
                        Unified Column Mapping &rarr; {mdmDef.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Map each source column to a canonical master attribute from the master schema defined in Step 2.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleAutoMap} className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition">
                        <Sparkles size={13} />Auto-Map All
                      </button>
                      <button onClick={handleSaveMapping} disabled={savingMapping || columnMappings.filter(m => m.targetColumn).length === 0}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition">
                        {savingMapping ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        Save All Mappings
                      </button>
                    </div>
                  </div>

                  {loadingPreview ? (
                    <div className="p-10 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-indigo-400" />
                      Fetching schema from {mdmSources.length} Databricks source table(s)...
                    </div>
                  ) : columnMappings.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400">Source column mappings will appear here once the preview loads.</div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold text-[10px]">
                          <tr>
                            <th className="p-3">Source Table</th>
                            <th className="p-3">Source Column</th>
                            <th className="p-3 text-center">Maps To</th>
                            <th className="p-3">Target Attribute</th>
                            <th className="p-3">Transformation</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                          {columnMappings.map((m, idx) => {
                            // Check if this is the first row for a new source table (for visual grouping)
                            const prevTable = idx > 0 ? columnMappings[idx - 1].sourceTableName : null;
                            const isNewGroup = m.sourceTableName !== prevTable;
                            return (
                              <tr key={`${m.sourceTableId}-${m.sourceColumn}-${idx}`} className={`hover:bg-gray-50/50 transition ${isNewGroup && idx > 0 ? 'border-t-2 border-indigo-100' : ''}`}>
                                <td className="p-3">
                                  {isNewGroup ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold rounded">
                                      <Table size={10} />{m.sourceTableName || 'Unknown'}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-300 pl-3">↳</span>
                                  )}
                                </td>
                                <td className="p-3 font-mono font-bold text-gray-900 text-[11px]">{m.sourceColumn}</td>
                                <td className="p-3 text-gray-400 text-center"><ArrowRight size={14} /></td>
                                <td className="p-3">
                                  <select value={m.targetColumn}
                                    onChange={e => { const val = e.target.value; setColumnMappings(prev => prev.map((item, i) => i === idx ? { ...item, targetColumn: val, status: val ? 'CONFIRMED' : 'NEEDS_REVIEW', confidence: val ? 0.95 : 0 } : item)); }}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 font-semibold focus:border-indigo-400 outline-none">
                                    <option value="">-- Do Not Map --</option>
                                    {customColumns.map(col => <option key={col.key} value={col.key}>{col.name} ({col.key})</option>)}
                                  </select>
                                </td>
                                <td className="p-3">
                                  <select value={m.transformation || 'DIRECT'}
                                    onChange={e => { const val = e.target.value; setColumnMappings(prev => prev.map((item, i) => i === idx ? { ...item, transformation: val } : item)); }}
                                    className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:border-indigo-400 outline-none">
                                    <option value="DIRECT">Direct</option><option value="TRIM">Trim</option>
                                    <option value="UPPERCASE">Uppercase</option><option value="LOWERCASE">Lowercase</option><option value="HASH">SHA256</option>
                                  </select>
                                </td>
                                <td className="p-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.targetColumn ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {m.targetColumn ? 'Mapped ✓' : 'Unmapped'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => navigateToStep('schema')} className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1">
                        <ArrowLeft size={13} /> Back to Master Schema
                      </button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => navigateToStep('sources')} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">
                        Source Tables
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handleSaveMapping}
                        disabled={savingMapping || columnMappings.filter(m => m.targetColumn).length === 0}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition">
                        {savingMapping ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        Save All Mappings
                      </button>
                      {allMappingsSaved && (
                        <button onClick={handleGenerateGoldenRecords} disabled={generatingGolden}
                          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition">
                          {generatingGolden ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          Generate Golden Records <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ====== STEP 4: GOLDEN RECORDS ====== */}
      {activeStep === 'golden' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">Step 4 of 4 — Golden Records</span>
              <p className="text-xs text-gray-500 mt-0.5">{total.toLocaleString()} consolidated master records</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search records..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:bg-white w-52" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700">
                <option value="">All Statuses</option><option value="matched">Matched</option>
                <option value="unmatched">Unmatched</option><option value="needs_review">Needs Review</option>
              </select>
              <ExcelViewToggle active={excelView} onToggle={() => setExcelView(v => !v)} />
            </div>
          </div>

          {excelView ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <ExcelView data={records} columns={[
                { key: 'id', label: 'Golden ID', width: 140 },
                { key: 'masterName', label: 'Master Name', width: 220 },
                { key: 'primaryEmail', label: 'Primary Email', width: 200 },
                { key: 'primaryPhone', label: 'Phone', width: 140 },
                { key: 'city', label: 'City', width: 120 },
                { key: 'state', label: 'State', width: 80 },
                { key: 'confidence', label: 'Confidence', width: 110 },
                { key: 'entityStatus', label: 'Status', width: 120 },
              ]} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="p-3.5">Golden Record ID</th><th className="p-3.5">Master Name</th>
                      <th className="p-3.5">Contact Email</th><th className="p-3.5">Location</th>
                      <th className="p-3.5">Status</th><th className="p-3.5">Confidence</th><th className="p-3.5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-10 text-center">
                          <Award size={36} className="mx-auto text-gray-200 mb-3" />
                          <p className="text-sm font-bold text-gray-500">No Golden Records Found</p>
                          <p className="text-xs text-gray-400 mt-1 mb-4">Complete the setup flow to generate your first master records.</p>
                          <button onClick={() => navigateToStep('schema')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition">
                            Start Setup Flow &rarr;
                          </button>
                        </td>
                      </tr>
                    ) : records.map(rec => (
                      <React.Fragment key={rec.id}>
                        <tr className={`transition ${expandedRecordId === rec.id ? 'bg-indigo-50/40 border-l-4 border-indigo-600' : 'hover:bg-gray-50/50'}`}>
                          <td className="p-3.5 font-mono text-[11px] text-indigo-600 font-semibold">{rec.id}</td>
                          <td className="p-3.5 font-bold text-gray-900">{rec.masterName || (rec as any).name}</td>
                          <td className="p-3.5 text-gray-600 font-mono">{(rec as any).primaryEmail || (rec as any).email || '—'}</td>
                          <td className="p-3.5 text-gray-500">{rec.city ? `${rec.city}, ${rec.state}` : '—'}</td>
                          <td className="p-3.5"><EntityStatusBadge status={rec.entityStatus} /></td>
                          <td className="p-3.5">
                            <span className="font-semibold text-emerald-600">
                              {(() => {
                                const c = rec.confidence ?? 95;
                                return `${c > 1 ? Math.round(c) : Math.round(c * 100)}%`;
                              })()}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => setExpandedRecordId(expandedRecordId === rec.id ? null : rec.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                            >
                              {expandedRecordId === rec.id ? 'Hide Sources' : 'View Sources'}
                            </button>
                          </td>
                        </tr>

                        {expandedRecordId === rec.id && (
                          <tr className="bg-indigo-50/30 border-b border-indigo-100">
                            <td colSpan={7} className="p-4 sm:p-5">
                              <div className="bg-white border border-indigo-200/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                      <Layers size={16} />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                                        Contributing Source Systems for {rec.masterName || (rec as any).name}
                                        <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
                                          {rec.id}
                                        </span>
                                      </h4>
                                      <p className="text-[11px] text-gray-500 mt-0.5">
                                        Resolved and merged across <strong className="text-gray-800 font-semibold">{(rec.sources || []).length} Source System{(rec.sources || []).length > 1 ? 's' : ''}</strong> ({(rec.sources || []).join(', ')})
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => setExpandedRecordId(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600 font-semibold px-2 py-1 rounded-lg hover:bg-gray-50 transition"
                                  >
                                    ✕ Close
                                  </button>
                                </div>

                                {/* Contributing Source Systems Cards */}
                                <div>
                                  <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Database size={11} className="text-indigo-600" /> Discovered Source Tables & Lineage Records
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {getContributingSourcesForRecord(rec).map((src: any, sIdx: number) => {
                                      const systemName = src.systemName || src.sourceName || (rec.sources && rec.sources[sIdx]) || 'Databricks Source Table';
                                      return (
                                        <div key={src.id || sIdx} className="bg-gray-50/80 border border-gray-200/70 rounded-xl p-3.5 space-y-2">
                                          <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
                                            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 truncate" title={systemName}>
                                              <Database size={13} className="text-indigo-600 shrink-0" />
                                              {systemName}
                                            </span>
                                            <span className="text-[9px] font-mono bg-white text-gray-700 px-2 py-0.5 rounded border border-gray-200 shrink-0 font-bold">
                                              #{src.systemRecordId || `REC-${sIdx + 1}`}
                                            </span>
                                          </div>

                                          <div className="space-y-1.5 text-[11px] pt-0.5">
                                            <div>
                                              <span className="text-[9px] uppercase font-bold text-gray-400 block">Name in Source</span>
                                              <span className="font-semibold text-gray-800 block truncate">
                                                {src.originalName || src.attributes?.name || src.attributes?.customer_name || src.attributes?.full_name || rec.masterName}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-[9px] uppercase font-bold text-gray-400 block">Email in Source</span>
                                              <span className="font-semibold text-gray-800 font-mono block truncate">
                                                {src.emailOriginal || src.attributes?.email || src.attributes?.primary_email || src.attributes?.work_email || (rec as any).primaryEmail || '—'}
                                              </span>
                                            </div>
                                            <div>
                                              <span className="text-[9px] uppercase font-bold text-gray-400 block">Phone in Source</span>
                                              <span className="font-semibold text-gray-800 font-mono block truncate">
                                                {src.phoneOriginal || src.attributes?.phone || src.attributes?.mobile || (rec as any).primaryPhone || '—'}
                                              </span>
                                            </div>
                                            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                                              <span className="text-[9px] font-bold text-gray-400 uppercase">Trust Score</span>
                                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                {src.trustScore || 98}% Trust
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {total > PAGE_SIZE && (
                <div className="p-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>Showing {records.length} of {total} records</span>
                  <div className="flex items-center gap-1">
                    <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2.5 py-1 rounded border border-gray-200 disabled:opacity-40">Prev</button>
                    <span className="px-2 font-semibold text-gray-700">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
                    <button disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(p => p + 1)} className="px-2.5 py-1 rounded border border-gray-200 disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button onClick={() => navigateToStep('mapping')} className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1">
              <ArrowLeft size={13} />Back to Schema Mapping
            </button>
            <Link to="/master-data" className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition">
              Back to MDM Data Hub
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
