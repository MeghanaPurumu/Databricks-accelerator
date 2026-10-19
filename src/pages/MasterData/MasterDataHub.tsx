import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, Plus, Search, ChevronRight, Layers, Table, CheckCircle2,
  AlertCircle, RefreshCw, Zap, Shield, ArrowRight, Trash2, Edit3, Eye,
  Building2, Users, Package, Truck, UserCheck, PlusCircle, Check, X, ShieldCheck
} from 'lucide-react';

import { MASTER_DEFINITIONS, MasterDefinition, mergeAndDeduplicateMdms, getCleanCustomMdms, normalizeMdmKey } from '../../types/mdmMaster';
import { mockSourceSystemService } from '../../services/sourceSystemService';
import { populateGoldenRecordsFromSources } from '../../services/masterDataService';
import { SourceSystem } from '../../types';
import {
  checkDatabricksConnection,
  fetchCatalogs,
  fetchSchemas,
  fetchTables,
  fetchTableCount,
  ensureMasterTableExists,
  createCustomMdmTarget
} from '../../services/databricksApiService';
import { getStoredConnection, CONNECTION_CHANGED_EVENT } from '../../services/connectionStore';
import { recordSuccessfulPipeline } from '../../services/pipelineHistoryService';

import AddSourceSystem from '../SourceSystems/AddSourceSystem';
import SchemaMapping from '../SourceSystems/SchemaMapping';
import ProcessingStatus from '../SourceSystems/ProcessingStatus';
import SourceDetails from '../SourceSystems/SourceDetails';

// Dynamic icon lookup for domains
const getDomainIcon = (iconName: string) => {
  switch (iconName?.toLowerCase()) {
    case 'users': return Users;
    case 'package': return Package;
    case 'truck': return Truck;
    case 'usercheck': return UserCheck;
    case 'building': return Building2;
    default: return Database;
  }
};

export default function MasterDataHub() {
  const navigate = useNavigate();

  // MDM Definitions state (built-in + custom stored in localStorage)
  const [mdmDefinitions, setMdmDefinitions] = useState<MasterDefinition[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMdmForm, setNewMdmForm] = useState({
    domain: '',
    name: '',
    description: '',
    targetCatalog: 'mdm',
    targetSchema: 'gold',
    targetTable: '',
  });
  const [creatingMdm, setCreatingMdm] = useState(false);
  const [createMdmError, setCreateMdmError] = useState('');

  // Source Systems state
  const [sources, setSources] = useState<SourceSystem[]>([]);
  const [selectedSource, setSelectedSource] = useState<SourceSystem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'mapping' | 'processing' | 'details'>('list');

  // Databricks Table Discovery
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [catalogs, setCatalogs] = useState<string[]>(['mdm', 'workspace', 'main', 'hive_metastore', 'samples']);
  const [catalogError, setCatalogError] = useState('');
  const [selectedCatalog, setSelectedCatalog] = useState('mdm');
  const [schemas, setSchemas] = useState<string[]>(['gold', 'silver', 'bronze', 'default']);
  const [selectedSchema, setSelectedSchema] = useState('gold');
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [discoveredTables, setDiscoveredTables] = useState<any[]>([]);
  const [selectedTableNames, setSelectedTableNames] = useState<string[]>([]);
  const [targetMdmId, setTargetMdmId] = useState('customer_mdm');
  const [mappingSource, setMappingSource] = useState<SourceSystem | null>(null);
  const [mappingSources, setMappingSources] = useState<SourceSystem[]>([]);
  const [mappingMdm, setMappingMdm] = useState<MasterDefinition | null>(null);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [registering, setRegistering] = useState(false);

  // Delete Custom MDM
  const handleDeleteCustomMdm = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this Master Domain?')) return;

    let savedCustom: MasterDefinition[] = [];
    try {
      savedCustom = JSON.parse(localStorage.getItem('lf_custom_mdm_targets') || '[]');
      savedCustom = savedCustom.filter(m => m.id !== id);
      localStorage.setItem('lf_custom_mdm_targets', JSON.stringify(savedCustom));
      window.dispatchEvent(new CustomEvent('mdm_definitions_changed'));
    } catch {
      // ignore
    }
    setMdmDefinitions(prev => prev.filter(m => m.id !== id));
  };

  // Refs used to coordinate discovery without triggering extra renders
  const selectedSchemaRef = useRef('default');
  const userChangedSchemaRef = useRef(false); // true only when user picks schema in dropdown
  const discoveryAbortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Load MDMs and Sources on mount
  const loadMdmsAndSources = async () => {
    // Read clean, deduplicated custom MDMs from localStorage
    const savedCustom = getCleanCustomMdms();
    const combined = mergeAndDeduplicateMdms(MASTER_DEFINITIONS, savedCustom);
    setMdmDefinitions(combined);

    // Load registered sources asynchronously
    try {
      const currentSources = await mockSourceSystemService.getSources();
      setSources(Array.isArray(currentSources) ? currentSources : []);
    } catch {
      setSources([]);
    }
  };

  useEffect(() => {
    loadMdmsAndSources();
  }, []);

  // Coordinated discovery function
  const runDiscovery = useCallback(async (catalog: string, schema: string) => {
    discoveryAbortRef.current.cancelled = true;
    const token = { cancelled: false };
    discoveryAbortRef.current = token;

    setLoadingDiscovery(true);
    setDiscoveredTables([]);
    setSelectedTableNames([]);

    try {
      const tbls = await fetchTables(catalog, schema);
      if (token.cancelled) return;
      setDiscoveredTables(tbls || []);
    } catch {
      if (!token.cancelled) setDiscoveredTables([]);
    } finally {
      if (!token.cancelled) setLoadingDiscovery(false);
    }
  }, []);

  // Fetch schemas for a given catalog and pick the initial schema
  const loadSchemasForCatalog = useCallback(async (catalog: string, preferredSchema?: string) => {
    setLoadingSchemas(true);
    setCatalogError('');
    try {
      const schs = await fetchSchemas(catalog);
      const fallback = catalog.toLowerCase() === 'mdm'
        ? ['gold', 'silver', 'bronze', 'default']
        : (['hive_metastore', 'workspace', 'main'].includes(catalog.toLowerCase())
            ? ['default', 'analytics', 'staging', 'bronze', 'silver', 'raw']
            : ['default', 'gold', 'silver', 'bronze', 'analytics']);
      const validSchemas = (schs && schs.length > 0) ? schs : fallback;
      setSchemas(validSchemas);

      let target = validSchemas[0];
      if (preferredSchema && validSchemas.includes(preferredSchema)) {
        target = preferredSchema;
      } else if (catalog.toLowerCase() === 'mdm' && validSchemas.includes('gold')) {
        target = 'gold';
      } else if (validSchemas.includes('default')) {
        target = 'default';
      }

      selectedSchemaRef.current = target;
      setSelectedSchema(target);
      await runDiscovery(catalog, target);
    } catch {
      const fallback = catalog.toLowerCase() === 'mdm'
        ? ['gold', 'silver', 'bronze', 'default']
        : ['default', 'analytics', 'staging', 'bronze'];
      setSchemas(fallback);
      const target = (catalog.toLowerCase() === 'mdm') ? 'gold' : fallback[0];
      selectedSchemaRef.current = target;
      setSelectedSchema(target);
      await runDiscovery(catalog, target);
    } finally {
      setLoadingSchemas(false);
    }
  }, [runDiscovery]);

  // Load catalogs from Databricks API and initialize schemas
  const loadCatalogs = useCallback(async (targetCat?: string) => {
    setLoadingCatalogs(true);
    const stored = getStoredConnection();
    try {
      const status = await checkDatabricksConnection();
      setDbConnected(status?.connected || stored.connected);
      const cats = await fetchCatalogs();
      const validCats = (cats && cats.length > 0) ? cats : ['mdm', 'workspace', 'main', 'hive_metastore', 'samples'];
      setCatalogs(validCats);

      const activeCat = targetCat && validCats.includes(targetCat)
        ? targetCat
        : (validCats.includes('mdm') ? 'mdm' : validCats[0]);

      setSelectedCatalog(activeCat);
      await loadSchemasForCatalog(activeCat);
    } catch {
      setDbConnected(stored.connected);
      const fallbackCats = ['mdm', 'workspace', 'main', 'hive_metastore', 'samples'];
      setCatalogs(fallbackCats);
      const activeCat = targetCat && fallbackCats.includes(targetCat) ? targetCat : 'mdm';
      setSelectedCatalog(activeCat);
      await loadSchemasForCatalog(activeCat);
    } finally {
      setLoadingCatalogs(false);
    }
  }, [loadSchemasForCatalog]);

  // Initial mount load
  useEffect(() => {
    loadCatalogs();
    const handleConn = () => {
      loadCatalogs();
    };
    window.addEventListener(CONNECTION_CHANGED_EVENT, handleConn);
    return () => window.removeEventListener(CONNECTION_CHANGED_EVENT, handleConn);
  }, [loadCatalogs]);

  // User selects a catalog
  const handleCatalogChange = async (cat: string) => {
    if (cat === '__custom_catalog__') {
      const custom = window.prompt('Enter Databricks Catalog Name (e.g. main, dev_catalog, lakehouse):');
      if (custom && custom.trim()) {
        const clean = custom.trim().toLowerCase();
        if (!catalogs.includes(clean)) {
          setCatalogs(prev => [clean, ...prev]);
        }
        setSelectedCatalog(clean);
        await loadSchemasForCatalog(clean);
      }
      return;
    }
    setSelectedCatalog(cat);
    await loadSchemasForCatalog(cat);
  };

  // User selects a schema
  const handleSchemaChange = async (sch: string) => {
    if (sch === '__custom_schema__') {
      const custom = window.prompt(`Enter Databricks Schema Name for catalog '${selectedCatalog}':`);
      if (custom && custom.trim()) {
        const clean = custom.trim().toLowerCase();
        if (!schemas.includes(clean)) {
          setSchemas(prev => [clean, ...prev]);
        }
        selectedSchemaRef.current = clean;
        setSelectedSchema(clean);
        await runDiscovery(selectedCatalog, clean);
      }
      return;
    }
    selectedSchemaRef.current = sch;
    setSelectedSchema(sch);
    await runDiscovery(selectedCatalog, sch);
  };


  // Handle Create New MDM Domain
  const handleCreateMdmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMdmForm.name || !newMdmForm.targetTable) {
      setCreateMdmError('Name and Target Table are required.');
      return;
    }

    setCreatingMdm(true);
    setCreateMdmError('');
    try {
      const cleanTable = newMdmForm.targetTable.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const domainKey = (newMdmForm.domain || newMdmForm.name).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const mdmId = `${domainKey}_mdm`;

      // Check if domain or name already exists in current definitions
      const currentAll = mergeAndDeduplicateMdms(MASTER_DEFINITIONS, getCleanCustomMdms());
      const proposedKey = normalizeMdmKey(newMdmForm.name);
      const proposedIdKey = normalizeMdmKey(mdmId);
      const isDuplicate = currentAll.some(m => {
        const kId = normalizeMdmKey(m.id);
        const kDom = normalizeMdmKey(m.domain);
        const kName = normalizeMdmKey(m.name);
        return kId === proposedIdKey || kDom === proposedKey || kName === proposedKey;
      });

      if (isDuplicate) {
        setCreateMdmError(`A Master Domain with this name or identifier already exists ("${newMdmForm.name}"). Please use a unique domain name.`);
        setCreatingMdm(false);
        return;
      }

      const newMdm: MasterDefinition = {
        id: mdmId,
        name: newMdmForm.name,
        domain: domainKey,
        description: newMdmForm.description || `Master Data Model for ${newMdmForm.name}`,
        iconName: 'Database',
        targetCatalog: 'mdm',
        targetSchema: 'gold',
        targetTable: cleanTable.endsWith('_golden_records') ? cleanTable : `${cleanTable}_golden_records`,
        canonicalAttributes: [
          { name: `${newMdmForm.name} ID`, key: 'record_id', type: 'string', category: 'ID', description: 'Primary Record ID', required: true },
          { name: 'Name', key: 'name', type: 'string', category: 'NAME', description: 'Primary Record Name', required: true },
          { name: 'Email', key: 'email', type: 'string', category: 'EMAIL', description: 'Contact Email' },
          { name: 'Phone', key: 'phone', type: 'string', category: 'PHONE', description: 'Contact Phone' },
        ],
        status: 'active'
      };

      // Call backend API if connected
      await createCustomMdmTarget({
        name: newMdm.name,
        domain: domainKey,
        targetCatalog: newMdm.targetCatalog,
        targetSchema: newMdm.targetSchema,
        targetTable: newMdm.targetTable,
        description: newMdm.description
      }).catch(err => console.warn('Backend custom MDM registration fallback:', err));

      // Ensure Master Table exists in Delta Lake
      await ensureMasterTableExists(
        newMdm.targetCatalog,
        newMdm.targetSchema,
        newMdm.targetTable
      ).catch(err => console.warn('Backend ensure master table fallback:', err));

      // Save to localStorage
      const savedCustom = getCleanCustomMdms();
      savedCustom.push(newMdm);
      localStorage.setItem('lf_custom_mdm_targets', JSON.stringify(savedCustom));
      window.dispatchEvent(new CustomEvent('mdm_definitions_changed'));

      // Update state with deduplicated definitions
      setMdmDefinitions(mergeAndDeduplicateMdms(MASTER_DEFINITIONS, savedCustom));
      setTargetMdmId(newMdm.id);
      setShowCreateModal(false);
      setNewMdmForm({ domain: '', name: '', description: '', targetCatalog: 'mdm', targetSchema: 'gold', targetTable: '' });

      // Navigate straight into the new MDM page to register source tables
      navigate(`/master-data/${newMdm.id}/golden-records?step=sources`);
    } catch (err: any) {
      setCreateMdmError(err?.message || 'Failed to create Master Domain');
    } finally {
      setCreatingMdm(false);
    }
  };

  // Register Selected Databricks Tables
  const handleRegisterSelectedTables = async () => {
    if (selectedTableNames.length === 0) return;
    setRegistering(true);
    try {
      const targetMdm = mdmDefinitions.find(m => m.id === targetMdmId) || mdmDefinitions[0];
      const addedSources: SourceSystem[] = [];
      for (const tableName of selectedTableNames) {
        const tableCount = await fetchTableCount(selectedCatalog, selectedSchema, tableName).catch(() => ({ rowCount: 1500 }));
        const displayName = `${tableName.toUpperCase()} (${selectedCatalog}.${selectedSchema})`;
        const newSource = await mockSourceSystemService.addSource({
          sourceName: displayName,
          name: displayName,
          sourceType: 'delta_table',
          type: 'Databricks',
          catalog: selectedCatalog,
          schema: selectedSchema,
          tableName: tableName,
          priority: 5,
          status: 'active',
          recordCount: tableCount.rowCount || 1200,
          recordsCount: tableCount.rowCount || 1200,
          connectionConfig: { catalog: selectedCatalog, schema: selectedSchema, table: tableName },
          targetMdmId: targetMdm.id,
          targetCatalog: targetMdm.targetCatalog,
          targetSchema: targetMdm.targetSchema,
          targetTable: targetMdm.targetTable,
        } as any);

        addedSources.push(newSource);
      }
      const updatedSources = await mockSourceSystemService.getSources();
      setSources(Array.isArray(updatedSources) ? updatedSources : []);
      window.dispatchEvent(new CustomEvent('lf_sources_changed'));
      if (addedSources.length > 0) {
        setMappingSources(addedSources);
        setMappingMdm(targetMdm);
        setViewMode('mapping');
      }
    } finally {
      setRegistering(false);
      setSelectedTableNames([]);
    }
  };

  // Save Column Mapping & Confirm & Start MDM Pipeline -> Redirect to MDM Page
  const handleSaveMappingAndStartPipeline = async (updatedSources: SourceSystem[]) => {
    try {
      for (const s of updatedSources) {
        const srcId = s.sourceId || (s as any).id;
        if (srcId) {
          await mockSourceSystemService.updateSource(srcId, { columnMappings: s.columnMappings });
        }
      }
      const currentSources = await mockSourceSystemService.getSources();
      setSources(Array.isArray(currentSources) ? currentSources : []);
      window.dispatchEvent(new CustomEvent('lf_sources_changed'));

      const targetMdm = mappingMdm || mdmDefinitions.find(m => m.id === targetMdmId) || mdmDefinitions[0];

      const started = Date.now();
      const result = await populateGoldenRecordsFromSources(updatedSources, targetMdm);
      const goldenCount = Array.isArray(result?.goldenRecords) ? result.goldenRecords.length : 0;
      const rows = updatedSources.reduce((acc, s) => acc + (s.recordCount || s.recordsCount || 0), 0);

      recordSuccessfulPipeline({
        mdmId: targetMdm.id,
        mdmName: targetMdm.name,
        recordsProcessed: rows || goldenCount,
        goldenGenerated: goldenCount,
        durationMs: Date.now() - started,
      });

      navigate(`/master-data/${targetMdm.id}/golden-records`);
    } catch (err) {
      console.error('Error starting MDM pipeline:', err);
      const targetMdm = mappingMdm || mdmDefinitions[0];
      navigate(`/master-data/${targetMdm.id}/golden-records`);
    }
  };

  // Delete source
  const handleDeleteSource = async (id: string) => {
    if (!window.confirm('Delete this registered source table?')) return;
    await mockSourceSystemService.deleteSource(id);
    const updatedSources = await mockSourceSystemService.getSources();
    setSources(Array.isArray(updatedSources) ? updatedSources : []);
    window.dispatchEvent(new CustomEvent('lf_sources_changed'));
  };

  const safeSources = Array.isArray(sources) ? sources : [];

  // Render Sub-Views (Mapping, Details, Add, Processing)
  const activeSourcesForMapping = mappingSources.length > 0 ? mappingSources : (mappingSource ? [mappingSource] : []);
  if (viewMode === 'mapping' && activeSourcesForMapping.length > 0) {
    const targetMdm = mappingMdm || mdmDefinitions.find(m => m.id === activeSourcesForMapping[0].targetMdmId) || mdmDefinitions[0];
    return (
      <SchemaMapping
        sources={activeSourcesForMapping}
        master={targetMdm}
        onSave={handleSaveMappingAndStartPipeline}
        onBack={() => {
          setViewMode('list');
          setMappingSources([]);
          setMappingSource(null);
          setMappingMdm(null);
        }}
      />
    );
  }

  if (viewMode === 'details' && selectedSource) {
    return (
      <SourceDetails
        source={selectedSource}
        onClose={() => setViewMode('list')}
        onEdit={(src) => {
          setMappingSource(src);
          setViewMode('mapping');
        }}
        onDisable={() => {}}
        onDelete={(src) => {
          handleDeleteSource(src.id);
          setViewMode('list');
        }}
        onRunProcessing={() => {}}
      />
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto bg-gray-50 flex flex-col h-full">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="text-indigo-600" size={22} />
            Master Data Hub
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage Master Data Models (MDMs), discover Databricks tables, and configure schema mappings for consolidation.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
        >
          <Plus size={15} />
          Create New MDM
        </button>
      </div>

      {/* SECTION 1: Registered Available MDMs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <Shield className="text-indigo-500" size={16} />
            Available MDMs
          </h2>
          <span className="text-xs font-semibold text-gray-400">
            {mdmDefinitions.length} Models Configured
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mdmDefinitions.map((mdm) => {
            const IconComponent = getDomainIcon(mdm.iconName);
            const registeredCount = safeSources.filter(s => s && (s.targetMdmId === mdm.id || s.targetTable === mdm.targetTable)).length;

            return (
              <div
                key={mdm.id}
                onClick={() => navigate(`/master-data/${mdm.id}/golden-records?step=sources`)}
                className="bg-white p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                      <IconComponent size={18} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Active
                      </span>
                      <button
                        onClick={(e) => handleDeleteCustomMdm(mdm.id, e)}
                        className="p-1 text-gray-300 hover:text-red-600 rounded transition opacity-60 group-hover:opacity-100"
                        title="Delete Master Domain"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition">
                    {mdm.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 min-h-[32px]">
                    {mdm.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400 font-medium">Target Table:</span>
                    <span className="font-mono text-gray-700 font-semibold">{mdm.targetCatalog}.{mdm.targetSchema}.{mdm.targetTable}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400 font-medium">Registered Sources:</span>
                    <span className="font-bold text-indigo-600">{registeredCount} Sources</span>
                  </div>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/master-data/${mdm.id}/golden-records?step=golden`);
                    }}
                    className="pt-1 flex items-center justify-end text-xs font-semibold text-indigo-600 hover:text-indigo-800 group-hover:translate-x-1 transition-transform cursor-pointer"
                  >
                    View Golden Records <ChevronRight size={14} className="ml-1" />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add MDM Card */}
          <div
            onClick={() => setShowCreateModal(true)}
            className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50/20 transition cursor-pointer min-h-[200px]"
          >
            <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
              <Plus size={20} />
            </div>
            <span className="text-xs font-bold text-gray-800">Create New MDM</span>
            <span className="text-[11px] text-gray-400 mt-1">Add custom domain & Delta target</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: Databricks Table Discovery & Registration */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Table size={16} className="text-indigo-600" />
              Discover Databricks Tables & Register Sources
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Select catalog & schema from Databricks connection to register tables under an MDM model.
            </p>
          </div>
          {dbConnected !== null && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${dbConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              <span className={`h-2 w-2 rounded-full ${dbConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              {dbConnected ? 'Databricks Connected' : 'Databricks Offline (Fallback Mode)'}
            </div>
          )}
        </div>

        {/* Catalog & Schema Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-3.5 rounded-lg border border-gray-100">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Catalog</label>
              <button
                type="button"
                onClick={() => loadCatalogs(selectedCatalog)}
                disabled={loadingCatalogs || loadingSchemas}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 transition"
                title="Refresh Catalogs from Databricks"
              >
                <RefreshCw size={11} className={loadingCatalogs ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            <select
              value={selectedCatalog}
              onChange={(e) => handleCatalogChange(e.target.value)}
              disabled={loadingCatalogs}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {!catalogs.length && <option value="">No catalogs loaded</option>}
              {catalogs.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom_catalog__">+ Enter Custom Catalog...</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Schema</label>
              {loadingSchemas && (
                <span className="text-[10px] text-indigo-600 font-semibold inline-flex items-center gap-1">
                  <RefreshCw size={11} className="animate-spin" /> Loading...
                </span>
              )}
            </div>
            <select
              value={selectedSchema}
              onChange={(e) => handleSchemaChange(e.target.value)}
              disabled={loadingSchemas}
              className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {!schemas.length && <option value="">Select a catalog to load schemas</option>}
              {schemas.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="__custom_schema__">+ Enter Custom Schema...</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1">Target MDM Model</label>
            <div className="flex gap-2">
              <select
                value={targetMdmId}
                onChange={(e) => {
                  if (e.target.value === '__create_new__') {
                    setShowCreateModal(true);
                    return;
                  }
                  setTargetMdmId(e.target.value);
                }}
                className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {mdmDefinitions.map(mdm => (
                  <option key={mdm.id} value={mdm.id}>{mdm.name} ({mdm.targetTable})</option>
                ))}
                <option value="__create_new__">+ Create New MDM…</option>
              </select>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-2.5 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition shrink-0"
                title="Create a new MDM if tables do not belong to an existing model"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {catalogError && <p className="text-xs text-amber-700">{catalogError}</p>}

        {/* Table List Selection */}
        {loadingDiscovery ? (
          <div className="flex items-center justify-center py-6 text-xs text-gray-500 gap-2">
            <RefreshCw size={15} className="animate-spin text-indigo-600" />
            Discovering tables in {selectedCatalog}.{selectedSchema}...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
              <span>Discovered Tables ({discoveredTables.length})</span>
              <span>{selectedTableNames.length} selected</span>
            </div>

            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
              {discoveredTables.map((tbl) => {
                const name = typeof tbl === 'string' ? tbl : tbl.tableName;
                const isSelected = selectedTableNames.includes(name);

                return (
                  <label
                    key={name}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-indigo-50/50 transition ${isSelected ? 'bg-indigo-50/30' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTableNames(prev => [...prev, name]);
                          else setSelectedTableNames(prev => prev.filter(t => t !== name));
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <Table size={14} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-800">{name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400">{selectedCatalog}.{selectedSchema}.{name}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                disabled={selectedTableNames.length === 0 || registering}
                onClick={handleRegisterSelectedTables}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                {registering ? <RefreshCw size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                Register Selected Tables ({selectedTableNames.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: Registered Source Tables List */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" />
              Registered Data Sources ({safeSources.length})
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Source tables linked to Master Data Models for automated consolidation and matching.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
              <tr>
                <th className="p-3">Source Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Target MDM</th>
                <th className="p-3">Record Count</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
              {safeSources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400">
                    No sources registered yet. Discover Databricks tables above to register your first source.
                  </td>
                </tr>
              ) : (
                safeSources.map((src) => {
                  const targetMdm = mdmDefinitions.find(m => m.id === src.targetMdmId) || { name: src.targetMdmId || 'Customer MDM' };
                  const rowId = src.sourceId || (src as any).id;
                  return (
                    <tr key={rowId} className="hover:bg-gray-50/80 transition">
                      <td className="p-3 font-semibold text-gray-900">{src.sourceName || src.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold uppercase">
                          {src.sourceType || src.type || 'Databricks'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
                          {targetMdm.name}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{(src.recordCount || src.recordsCount || 0).toLocaleString()}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setMappingSource(src);
                            setMappingMdm(mdmDefinitions.find(m => m.id === src.targetMdmId) || null);
                            setViewMode('mapping');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 rounded text-gray-600 transition"
                        >
                          Schema Mapping
                        </button>
                        <button
                          onClick={() => handleDeleteSource(rowId)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                          title="Delete source"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW MDM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <PlusCircle className="text-indigo-600" size={18} />
                Create New MDM
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            {createMdmError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-100">
                {createMdmError}
              </div>
            )}

            <form onSubmit={handleCreateMdmSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Domain Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Patient MDM, Asset MDM, Account MDM"
                  value={newMdmForm.name}
                  onChange={(e) => setNewMdmForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of this master entity domain..."
                  value={newMdmForm.description}
                  onChange={(e) => setNewMdmForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Read-only target location (mdm.gold) - not editable by user */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700">Target Location:</span>
                  <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                    mdm.gold
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Target is automatically provisioned in the <strong>mdm</strong> catalog and <strong>gold</strong> schema.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Target Delta Table *</label>
                <input
                  type="text"
                  placeholder="e.g. patient_golden_records"
                  value={newMdmForm.targetTable}
                  onChange={(e) => setNewMdmForm(f => ({ ...f, targetTable: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingMdm}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                  {creatingMdm && <RefreshCw size={12} className="animate-spin" />}
                  Create New MDM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
