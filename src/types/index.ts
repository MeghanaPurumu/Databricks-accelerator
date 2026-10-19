// ============================================================
// Core MDM Data Types
// ============================================================

export interface MasterRecord {
  id: string;
  mdmCustomerId?: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  sourceSystem: string;
  status: 'active' | 'inactive' | 'pending';
  matchStatus: 'matched' | 'unmatched' | 'potential_duplicate';
  goldenRecordId?: string;
  domain: 'customer' | 'product' | 'supplier' | 'location';
  lastUpdated: string;
  attributes: Record<string, string | number | boolean>;
}

export interface SourceRecord {
  id: string;
  systemName: string;
  systemRecordId: string;
  attributes: Record<string, string | number | boolean>;
  trustScore: number;
  lastUpdated: string;
  /** Raw email before cleaning — preserved for display */
  emailOriginal?: string;
  /** Raw phone before cleaning — preserved for display */
  phoneOriginal?: string;
  /** Raw full name as it appeared in source */
  originalName?: string;
  /** True when DOB day/month is ambiguous in source data */
  dobAmbiguous?: boolean;
}

// ============================================================
// Golden Records — Enhanced Schema
// ============================================================

export interface AlternateEmail {
  email: string;
  email_original?: string;
  source: string;
  source_record_id: string;
  record_timestamp?: string;
  is_primary: boolean;
}

export interface AlternatePhone {
  phone: string;
  phone_original?: string;
  source: string;
  source_record_id: string;
  record_timestamp?: string;
  is_primary: boolean;
}

export interface AttributeLineageEntry {
  value: string | null;
  source: string;
  source_record_id: string;
}

export interface GoldenRecord {
  id: string;
  /** Stable MDM000001-format ID, persisted across pipeline re-runs */
  mdmCustomerId?: string;
  entity: string;
  masterName: string;
  /** Survived primary email (source authority applied) */
  primaryEmail?: string;
  /** All other distinct emails found across sources */
  alternateEmails?: AlternateEmail[];
  /** Survived primary phone */
  primaryPhone?: string;
  /** All other distinct phones found across sources */
  alternatePhones?: AlternatePhone[];
  city?: string;
  state?: string;
  dob?: string;
  address?: string;
  sourceRecordsCount: number;
  sources: string[];
  qualityScore: number;
  confidence: number;
  /** COMPLETE | PARTIAL | MINIMAL | INVALID */
  entityStatus?: string;
  reviewStatus?: string;
  reviewReason?: string;
  /** Flags raised by cluster_validator */
  validatorFlags?: string[];
  maxMatchProb?: number | null;
  minMatchProb?: number | null;
  avgMatchProb?: number | null;
  /** Per-attribute dict: which source contributed the winning value */
  attributeLineage?: Record<string, AttributeLineageEntry>;
  status: 'active' | 'deprecated' | 'merged';
  lastUpdated: string;
}

// ============================================================
// Match Evidence — Field-level comparison for Stewardship
// ============================================================

export type FieldMatchStatus =
  | 'EXACT_MATCH'
  | 'PARTIAL_MATCH'
  | 'MISMATCH'
  | 'ONE_NULL'
  | 'BOTH_NULL'
  | 'UNKNOWN';

export interface FieldEvidence {
  field: string;
  valueA: string;
  valueB: string;
  status: FieldMatchStatus;
}

export interface MatchEvidence {
  pairId: string;
  matchProbability: number;
  fieldEvidence: FieldEvidence[];
  matchingCount: number;
  conflictingCount: number;
  unknownCount: number;
}

// ============================================================
// Audit Trail
// ============================================================

export type AuditAction = 'MERGE' | 'REJECT' | 'REVIEW_LATER' | 'APPROVE' | 'SPLIT' | 'ROLLBACK';

export interface AuditEntry {
  id: string;
  clusterId: string;
  mdmCustomerId?: string;
  pairId?: string;
  action: AuditAction;
  steward: string;
  timestamp: string;
  reason?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

// ============================================================
// Potential Duplicate — Enhanced
// ============================================================

export interface PotentialDuplicate {
  id: string;
  recordA: MasterRecord;
  recordAMdmId?: string;
  recordB: MasterRecord;
  recordBMdmId?: string;
  matchScore: number;
  matchingAttributes: string[];
  conflictingAttributes: string[];
  unknownAttributes?: string[];
  status: 'pending' | 'merged' | 'rejected' | 'not_a_duplicate';
  hasEvidence?: boolean;
}

// ============================================================
// Data Quality
// ============================================================

export interface DataQualitySourceSummary {
  count: number;
  avgScore: number;
  statuses: Record<string, number>;
}

export interface DataQualityReport {
  available: boolean;
  totalRecords?: number;
  avgScore?: number;
  byStatus?: Record<string, number>;
  bySource?: Record<string, DataQualitySourceSummary>;
}

export interface QualityMetric {
  name: string;
  score: number;
  description: string;
  trend: 'up' | 'down' | 'stable';
}

export interface DomainQuality {
  domain: string;
  overallScore: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  uniqueness: number;
  validity: number;
  timeliness: number;
}

export interface QualityException {
  id: string;
  recordId: string;
  recordName: string;
  domain: 'customer' | 'product' | 'supplier' | 'location';
  ruleName: string;
  severity: 'critical' | 'warning' | 'info';
  currentValue: string;
  expectedValue: string;
  status: 'open' | 'resolved' | 'ignored';
  assignedSteward: string;
  created: string;
}

export interface BusinessRule {
  id: string;
  ruleName: string;
  domain: 'customer' | 'product' | 'supplier' | 'location';
  attribute: string;
  condition: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'inactive';
  createdBy: string;
  lastUpdated: string;
}

// ============================================================
// Stewardship
// ============================================================

export interface StewardshipTask {
  id: string;
  priority: 'high' | 'medium' | 'low';
  type: 'duplicate_review' | 'quality_issue' | 'conflicting_attribute' | 'merge_request' | 'approval_request';
  recordId: string;
  recordName: string;
  issue: string;
  severityScore: number;
  assignedTo: string;
  age: string;
  status: 'open' | 'in_progress' | 'resolved';
}

// ============================================================
// Lineage
// ============================================================

export interface LineageStep {
  id: string;
  name: string;
  type: 'source' | 'ingestion' | 'standardization' | 'matching' | 'survivorship' | 'golden_record' | 'consumer';
  status: 'success' | 'running' | 'failed' | 'idle';
  description: string;
  timestamp: string;
  recordsCount?: number;
  details?: Record<string, string | number>;
}

// ============================================================
// Source Systems
// ============================================================

export type SourceType = 'delta_table' | 'csv' | 'manual';
export type SourceStatus = 'active' | 'inactive' | 'processing' | 'error';

export interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string; // MDM standard field, or '' if unmapped
  confidence?: number;  // 0-1 auto-detect confidence
  required: boolean;
  status?: 'RECOMMENDED' | 'CONFIRMED' | 'MODIFIED' | 'UNMAPPED' | 'NEEDS_REVIEW';
}

export interface SourceSystem {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  catalog?: string;
  schema?: string;
  tableName?: string;
  fileName?: string;
  description?: string;
  priority: number;
  status: SourceStatus;
  recordCount?: number;
  recordsCount?: number;
  columnCount?: number;
  columnMappings?: ColumnMapping[];
  createdAt: string;
  updatedAt: string;

  // Additional optional fields for UI/MDM compatibility
  id?: string;
  name?: string;
  type?: SourceType;
  targetMdmId?: string;
  targetCatalog?: string;
  targetSchema?: string;
  targetTable?: string;
  connectionConfig?: {
    host?: string;
    catalog?: string;
    schema?: string;
    warehouseId?: string;
    token?: string;
    [key: string]: any;
  };
}

// ============================================================
// Available Tables (discovered, not yet registered)
// ============================================================

export interface AvailableTable {
  tableId: string;       // unique key for selection state (usually catalog.schema.tableName)
  tableName: string;
  catalog: string;
  schema: string;
  tableType: string;     // 'Delta' | 'Parquet' | 'CSV' etc.
  recordCount: number;
  columnCount: number;
  lastUpdated: string;
  columns?: string[];    // column names
}

// ============================================================
// Processing
// ============================================================

export interface ProcessingStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

export interface ProcessingSummary {
  sourcesProcessed: number;
  inputRecords: number;
  matchedRecords: number;
  needsReview: number;
  unmatchedRecords: number;
}

export interface ProcessingRun {
  runId: string;
  sourceIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: ProcessingStep[];
  startedAt: string;
  completedAt?: string;
  summary?: ProcessingSummary;
}
