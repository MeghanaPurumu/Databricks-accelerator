import { SourceSystem, AvailableTable, ColumnMapping, ProcessingRun, ProcessingStep } from '../types';
import { getLocalStorageData, saveLocalStorageData, deleteSourceAndCleanRecords, deleteMultipleSourcesAndCleanRecords } from './masterDataService';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
const SOURCES_KEY = 'lf_source_systems';
const RUN_KEY = 'lf_last_processing_run';

// ----------------------------------------------------------------
// MDM Standard Columns (target schema)
// ----------------------------------------------------------------
export const MDM_TARGET_COLUMNS: { value: string; label: string; required: boolean }[] = [
  { value: '',           label: '— Unmapped —',   required: false },
  { value: 'unique_id',  label: 'unique_id',       required: true  },
  { value: 'first_name', label: 'first_name',      required: true  },
  { value: 'last_name',  label: 'last_name',       required: false },
  { value: 'dob',        label: 'dob',             required: false },
  { value: 'email',      label: 'email',           required: true  },
  { value: 'phone',      label: 'phone',           required: false },
  { value: 'address',    label: 'address',         required: false },
  { value: 'city',       label: 'city',            required: false },
  { value: 'state',      label: 'state',           required: false },
  { value: 'postcode',   label: 'postcode',        required: false },
];

// ----------------------------------------------------------------
// Auto-mapping heuristics
// ----------------------------------------------------------------
const MAPPING_RULES: { patterns: string[]; target: string }[] = [
  { patterns: ['customerid','loyaltycardno','user_id','ticket_customer_id','account_id','contact_id','erp_customer_id','app_user_id','referral_id','_id','record_id','id'], target: 'record_id' },
  { patterns: ['fname','first_name','first','given_name','display_name','cust_name'], target: 'first_name' },
  { patterns: ['lname','last_name','last','family_name'], target: 'last_name' },
  { patterns: ['full_name','membername','referred_name','holder_name','customer_name'], target: 'customer_name' },
  { patterns: ['dob','date_of_birth','birth_date'], target: 'dob' },
  { patterns: ['email','email_addr','email_address','email_id','referred_email','mail'], target: 'email' },
  { patterns: ['phone','mobile','contact_phone','mobile_number','phone_number','contact_no','referred_phone'], target: 'phone' },
  { patterns: ['street','street_addr','billing_street','full_address','address','addr'], target: 'address' },
  { patterns: ['city','city_name','billing_city','preferred_store_city','signup_city'], target: 'city' },
  { patterns: ['state','state_cd','state_name','billing_state'], target: 'state' },
  { patterns: ['zip','zip_cd','zip_code','postcode','postal','postal_code','signup_zip','billing_zip'], target: 'postal_code' },
  { patterns: ['country','country_code','country_name'], target: 'country' },
];

export function autoMapColumns(columns: string[]): ColumnMapping[] {
  return columns.map(col => {
    const normalized = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    let target = '';
    let confidence = 0;

    for (const rule of MAPPING_RULES) {
      for (const pattern of rule.patterns) {
        const normPattern = pattern.replace(/[^a-z0-9]/g, '');
        if (normalized === normPattern || normalized.includes(normPattern) || normPattern.includes(normalized)) {
          target = rule.target;
          confidence = normalized === normPattern ? 1.0 : 0.8;
          break;
        }
      }
      if (target) break;
    }

    return {
      sourceColumn: col,
      targetColumn: target,
      confidence,
      required: target === 'unique_id' || target === 'first_name' || target === 'email',
    };
  });
}

// ----------------------------------------------------------------
// Source ID generator — monotonic counter ensures uniqueness even
// when multiple sources are registered within the same millisecond
// ----------------------------------------------------------------
let _srcCounter = 0;
function generateSourceId(tableName: string): string {
  const prefix = (tableName || 'SRC').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const cnt = (++_srcCounter).toString(36).toUpperCase().padStart(2, '0');
  const rnd = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `SRC-${prefix}-${ts}${cnt}${rnd}`;
}

// ----------------------------------------------------------------
// Purge legacy mock sources & fix duplicate IDs on load
// ----------------------------------------------------------------
const isBrowser = typeof window !== 'undefined';
if (isBrowser) {
  const current = getLocalStorageData<SourceSystem[]>(SOURCES_KEY, []);

  // 1. Clear any legacy seeded mock IDs
  const hasLegacySeed = current.some(s =>
    s.sourceId?.startsWith('SRC-CRM') ||
    s.sourceId?.startsWith('SRC-POS') ||
    s.sourceId?.startsWith('SRC-SUP') ||
    s.sourceId?.startsWith('SRC-WEB') ||
    s.tableName?.includes('customers_crm_legacy')
  );
  if (hasLegacySeed) {
    saveLocalStorageData(SOURCES_KEY, []);
  } else {
    // 2. Fix any duplicate sourceIds that may have been created by
    //    the old ID generator (Date.now collision at same millisecond)
    const seenIds = new Set<string>();
    let hasDuplicates = false;
    const deduplicated = current.map(s => {
      if (seenIds.has(s.sourceId)) {
        hasDuplicates = true;
        // Assign a fresh unique ID, preserving all other data
        let freshId = generateSourceId(s.tableName ?? s.sourceName ?? 'SRC');
        while (seenIds.has(freshId)) {
          freshId = generateSourceId(s.tableName ?? s.sourceName ?? 'SRC');
        }
        seenIds.add(freshId);
        return { ...s, sourceId: freshId };
      }
      seenIds.add(s.sourceId);
      return s;
    });
    if (hasDuplicates) {
      saveLocalStorageData(SOURCES_KEY, deduplicated);
    }
  }
}

// ----------------------------------------------------------------
// CRUD operations
// ----------------------------------------------------------------

export const getRegisteredSources = (): SourceSystem[] =>
  getLocalStorageData<SourceSystem[]>(SOURCES_KEY, []);

export const saveRegisteredSources = (sources: SourceSystem[]): void =>
  saveLocalStorageData(SOURCES_KEY, sources);

// ----------------------------------------------------------------
// Table Discovery service
// ----------------------------------------------------------------
export interface TableDiscoveryService {
  discoverTables(): Promise<AvailableTable[]>;
  getTableSchema(tableId: string): Promise<AvailableTable | null>;
}

export const mockTableDiscovery: TableDiscoveryService = {
  discoverTables: async () => {
    return [];
  },
  getTableSchema: async () => {
    return null;
  },
};

// ----------------------------------------------------------------
// Source System service
// ----------------------------------------------------------------
export interface SourceSystemService {
  getSources(): Promise<SourceSystem[]>;
  getSource(id: string): Promise<SourceSystem | null>;
  addSource(source: Omit<SourceSystem, 'sourceId' | 'createdAt' | 'updatedAt'>): Promise<SourceSystem>;
  updateSource(id: string, patch: Partial<SourceSystem>): Promise<SourceSystem | null>;
  deleteSource(id: string): Promise<void>;
  deleteMultipleSources(ids: string[]): Promise<void>;
  registerTablesAsSources(tableIds: string[], tables: AvailableTable[]): Promise<SourceSystem[]>;
  processSelectedSources(sourceIds: string[]): Promise<ProcessingRun>;
  getLastProcessingRun(): Promise<ProcessingRun | null>;
}

export const mockSourceSystemService: SourceSystemService = {

  getSources: async () => {
    return new Promise(resolve =>
      setTimeout(() => resolve(getRegisteredSources()), 50)
    );
  },

  getSource: async (id) => {
    return new Promise(resolve =>
      setTimeout(() => resolve(getRegisteredSources().find(s => s.sourceId === id) ?? null), 50)
    );
  },

  addSource: async (partial) => {
    return new Promise(resolve => {
      const sources = getRegisteredSources();
      const now = new Date().toISOString();
      const newSource: SourceSystem = {
        ...partial,
        sourceId: generateSourceId(partial.tableName ?? partial.sourceName),
        createdAt: now,
        updatedAt: now,
      };
      sources.push(newSource);
      saveRegisteredSources(sources);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lf_sources_changed'));
      }
      setTimeout(() => resolve(newSource), 50);
    });
  },

  updateSource: async (id, patch) => {
    return new Promise(resolve => {
      const sources = getRegisteredSources();
      const idx = sources.findIndex(s => s.sourceId === id);
      if (idx < 0) { resolve(null); return; }
      sources[idx] = { ...sources[idx], ...patch, updatedAt: new Date().toISOString() };
      saveRegisteredSources(sources);
      setTimeout(() => resolve(sources[idx]), 50);
    });
  },

  deleteSource: async (id) => {
    await deleteSourceAndCleanRecords(id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lf_sources_changed'));
    }
  },

  deleteMultipleSources: async (ids) => {
    await deleteMultipleSourcesAndCleanRecords(ids);
  },

  registerTablesAsSources: async (tableIds, tables) => {
    return new Promise(resolve => {
      const existing = getRegisteredSources();
      const existingTableNames = new Set(existing.map(s => s.tableName));
      // Also track IDs already in-flight during this batch to prevent intra-batch collisions
      const existingIds = new Set(existing.map(s => s.sourceId));
      const now = new Date().toISOString();
      const newSources: SourceSystem[] = [];
      let nextPriority = Math.max(0, ...existing.map(s => s.priority)) + 1;

      for (const tableId of tableIds) {
        const table = tables.find(t => t.tableId === tableId);
        if (!table || existingTableNames.has(table.tableName)) continue;

        // Generate a guaranteed-unique ID
        let newId = generateSourceId(table.tableName);
        while (existingIds.has(newId)) {
          newId = generateSourceId(table.tableName);
        }
        existingIds.add(newId);

        const mappings = autoMapColumns(table.columns ?? []);
        const src: SourceSystem = {
          sourceId: newId,
          sourceName: table.tableName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase()),
          sourceType: 'delta_table',
          catalog: table.catalog,
          schema: table.schema,
          tableName: table.tableName,
          description: `Registered Databricks table: ${table.catalog}.${table.schema}.${table.tableName}`,
          priority: nextPriority++,
          status: 'active',
          recordCount: table.recordCount,
          columnCount: table.columnCount,
          columnMappings: mappings,
          createdAt: now,
          updatedAt: now,
        };
        existing.push(src);
        newSources.push(src);
      }
      saveRegisteredSources(existing);
      setTimeout(() => resolve(newSources), 100);
    });
  },

  processSelectedSources: async (sourceIds) => {
    return new Promise(resolve => {
      const run: ProcessingRun = {
        runId: `RUN-${Date.now()}`,
        sourceIds,
        status: 'running',
        startedAt: new Date().toISOString(),
        steps: [
          { key: 'validation',      label: 'Source Validation',       status: 'pending' },
          { key: 'schema',          label: 'Schema Validation',        status: 'pending' },
          { key: 'standardization', label: 'Data Standardization',     status: 'pending' },
          { key: 'entity_res',      label: 'Entity Resolution',        status: 'pending' },
          { key: 'clustering',      label: 'Clustering',               status: 'pending' },
          { key: 'survivorship',    label: 'Survivorship',             status: 'pending' },
          { key: 'golden',          label: 'Golden Record Generation', status: 'pending' },
        ],
      };
      saveLocalStorageData(RUN_KEY, run);
      setTimeout(() => resolve(run), 100);
    });
  },

  getLastProcessingRun: async () => {
    return new Promise(resolve =>
      setTimeout(() => resolve(getLocalStorageData<ProcessingRun | null>(RUN_KEY, null)), 50)
    );
  },
};
