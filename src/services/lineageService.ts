import { LineageStep } from '../types';

export interface LineageService {
  getSystemLineage(): Promise<LineageStep[]>;
  getRecordLineage(recordId: string): Promise<LineageStep[]>;
}

// ----------------------------------------------------------------------------
// Realistic Mock Data
// ----------------------------------------------------------------------------

const mockSystemLineage: LineageStep[] = [
  {
    id: 'step-1-sources',
    name: 'Customer Source Systems Ingestion',
    type: 'source',
    status: 'success',
    description: 'Ingest raw customer records from registered Databricks platform catalogs, schemas, and staging tables into lakehouse bronze storage.',
    timestamp: '2026-09-10 14:00:00',
    recordsCount: 0,
    details: {
      activeSources: 1,
      fileType: 'Delta / Parquet',
      avgLatencyMs: 120
    }
  },
  {
    id: 'step-2-ingest',
    name: 'Databricks Table Ingest & Staging',
    type: 'ingestion',
    status: 'success',
    description: 'Incrementally stages records from registered Databricks sources into the unified mdm_temp staging format with source lineage tracking.',
    timestamp: '2026-09-10 14:02:15',
    recordsCount: 0,
    details: {
      targetTable: 'mdm.bronze.mdm_temp',
      clusterNodes: 4,
      runtimeSec: 12
    }
  },
  {
    id: 'step-3-standard',
    name: 'Standardization & Validation',
    type: 'standardization',
    status: 'success',
    description: 'Normalizes date formats, validates email and phone syntax, standardizes address casing, and calculates source confidence priorities.',
    timestamp: '2026-08-19 14:05:00',
    recordsCount: 2325,
    details: {
      targetTable: 'silver_customer_master_splink_input',
      failedRulesCount: 4,
      avgCompletenessScore: 96.4
    }
  },
  {
    id: 'step-4-match',
    name: 'Entity Resolution — Splink ML Model',
    type: 'matching',
    status: 'success',
    description: 'Splink performs probabilistic record linkage using blocking on postcode, phone, email, name+DOB. Compares names, DOB, email, phone, address, and postcode similarity.',
    timestamp: '2026-08-19 14:08:30',
    recordsCount: 2325,
    details: {
      algorithm: 'Splink (DuckDB backend)',
      matchesDetected: 2549,
      activeBlockingKeys: 5
    }
  },
  {
    id: 'step-5-survive',
    name: 'Survivorship Logic Engine (create_golden_records.py)',
    type: 'survivorship',
    status: 'success',
    description: 'Clusters records at threshold ≥ 0.9 match probability. Resolves attribute-level conflicts using vote count, source priority (CRM wins), and data completeness scoring.',
    timestamp: '2026-08-19 14:09:00',
    recordsCount: 897,
    details: {
      conflictsResolved: 46,
      pendingManualStewardship: 25
    }
  },
  {
    id: 'step-6-golden',
    name: 'Golden Records Registry (customer_golden_records.csv)',
    type: 'golden_record',
    status: 'success',
    description: 'Persists consolidated, single-source-of-truth customer golden records into the golden registry. Each record contains best survivorship values and source cluster metadata.',
    timestamp: '2026-08-19 14:10:00',
    recordsCount: 897,
    details: {
      targetTable: 'gold_customer_master_records',
      totalActiveMasterEntities: 897
    }
  },
  {
    id: 'step-7-consumer',
    name: 'Downstream Sync (Snowflake & BI)',
    type: 'consumer',
    status: 'success',
    description: 'Synchronizes customer golden records with enterprise data warehouses, CRM endpoints, and analytics dashboards.',
    timestamp: '2026-08-19 14:15:00',
    recordsCount: 897,
    details: {
      destinationsCount: 3,
      avgSyncDurationSec: 42
    }
  }
];

export const mockLineageService: LineageService = {
  getSystemLineage: async () => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockSystemLineage), 400);
    });
  },

  getRecordLineage: async (recordId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Record-level lineage shows sources feeding into standardization, matching, and outputting to Golden Record
        const recordLineage: LineageStep[] = [
          {
            id: 'rec-src-1',
            name: 'Salesforce CRM (CUST-001)',
            type: 'source',
            status: 'success',
            description: 'Contributes core name, phone, and Salesforce metadata.',
            timestamp: '2026-08-19 10:15:30',
            details: {
              trustScore: 88,
              recordId: '0018W00002N8gPyQAJ'
            }
          },
          {
            id: 'rec-src-2',
            name: 'SAP ERP (CUST-002)',
            type: 'source',
            status: 'success',
            description: 'Contributes billing/address details and corporate organization information.',
            timestamp: '2026-08-19 11:22:15',
            details: {
              trustScore: 92,
              recordId: '100084729'
            }
          },
          {
            id: 'rec-match',
            name: 'Match Rule: EMAIL_AND_PHONE',
            type: 'matching',
            status: 'success',
            description: 'Matched records automatically due to exact email and phone match.',
            timestamp: '2026-08-19 11:24:00',
            details: {
              confidenceScore: 0.96
            }
          },
          {
            id: 'rec-survive',
            name: 'Attribute-Level Survivorship',
            type: 'survivorship',
            status: 'success',
            description: 'Name selected from Salesforce CRM; Email selected from SAP ERP (higher trust score).',
            timestamp: '2026-08-19 11:24:45'
          },
          {
            id: 'rec-gold',
            name: 'Golden Record (GOLD-CUST-101)',
            type: 'golden_record',
            status: 'success',
            description: 'Authoritative customer master record.',
            timestamp: '2026-08-19 11:25:00'
          }
        ];
        resolve(recordLineage);
      }, 350);
    });
  }
};
