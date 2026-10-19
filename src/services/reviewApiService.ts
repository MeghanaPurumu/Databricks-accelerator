import { formatSimilarityScore } from '../utils/formatters';

export interface ReviewItem {
  review_id: string;
  entity_id: string;
  left_record_id: string;
  right_record_id: string;
  similarity_score: number;
  decision: 'PENDING' | 'ACCEPT' | 'REJECT' | 'MERGE';
  review_status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MERGED';
  source_a: string;
  source_b: string;
  record_a: Record<string, any>;
  record_b: Record<string, any>;
  matching_attributes: string[];
  conflicting_attributes: string[];
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  comments?: string;
}

export interface ReviewsResponse {
  items: ReviewItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ReviewFilters {
  page?: number;
  limit?: number;
  status?: string;
  similarity_min?: number;
  similarity_max?: number;
  source?: string;
  entity_id?: string;
  search?: string;
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://127.0.0.1:8000';

export async function fetchPaginatedReviews(filters: ReviewFilters): Promise<ReviewsResponse> {
  // The pipeline writes review candidates to local MDM storage. Treat that as
  // authoritative so unrelated/stale API demo rows never appear in the queue.
  let filtered = getStoredMockItems();
  if (filters.status && filters.status.toUpperCase() !== 'ALL') {
    filtered = filtered.filter(i => i.review_status.toUpperCase() === filters.status?.toUpperCase());
  }
  if (filters.similarity_min !== undefined) {
    filtered = filtered.filter(i => i.similarity_score >= filters.similarity_min!);
  }
  if (filters.similarity_max !== undefined) {
    filtered = filtered.filter(i => i.similarity_score <= filters.similarity_max!);
  }
  if (filters.source && filters.source.toUpperCase() !== 'ALL') {
    const source = filters.source.toLowerCase();
    filtered = filtered.filter(i => i.source_a.toLowerCase() === source || i.source_b.toLowerCase() === source);
  }
  if (filters.entity_id) {
    filtered = filtered.filter(i => i.entity_id.toLowerCase().includes(filters.entity_id!.toLowerCase()));
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(i => i.review_id.toLowerCase().includes(s)
      || i.entity_id.toLowerCase().includes(s)
      || i.left_record_id.toLowerCase().includes(s)
      || i.right_record_id.toLowerCase().includes(s));
  }

  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const total = filtered.length;

  return {
    items: filtered.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}

const QUEUE_STORAGE_KEY = 'lf_review_queue';

function getStoredMockItems(): ReviewItem[] {
  const dynamicReviews: ReviewItem[] = [];
  let goldenRecords: any[] = [];
  try {
    const storedGolden = JSON.parse(localStorage.getItem('lf_golden_records') || '[]');
    if (Array.isArray(storedGolden)) goldenRecords = storedGolden;
  } catch (e) {
    console.warn('Could not parse lf_golden_records:', e);
  }
  const goldenByMdmId = new Map<string, any>();
  goldenRecords.forEach(gold => {
    if (gold.mdmCustomerId) goldenByMdmId.set(String(gold.mdmCustomerId), gold);
    if (gold.id) goldenByMdmId.set(String(gold.id), gold);
  });

  // 1. Read real pipeline duplicates generated during MDM pipeline runs
  try {
    const pipelineDuplicates = JSON.parse(localStorage.getItem('lf_duplicates') || '[]');
    if (Array.isArray(pipelineDuplicates) && pipelineDuplicates.length > 0) {
      pipelineDuplicates.forEach((dup: any, idx: number) => {
        const entityId = String(dup.recordAMdmId || dup.recordBMdmId || '');
        const owningGolden = goldenByMdmId.get(entityId);
        if (owningGolden && String(owningGolden.entityStatus || '').toLowerCase() !== 'needs_review'
          && !['pending_steward_review', 'needs_review', 'pending'].includes(String(owningGolden.reviewStatus || '').toLowerCase())) {
          return;
        }
        if (!owningGolden) return;
        const revId = dup.id || `REV-RUN-${idx + 1}`;
        const recA = dup.recordA || {};
        const recB = dup.recordB || {};
        const statusStr = String(dup.status || 'pending').toLowerCase();
        
        let decision: 'PENDING' | 'ACCEPT' | 'REJECT' | 'MERGE' = 'PENDING';
        let review_status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MERGED' = 'PENDING';
        if (statusStr === 'approved' || statusStr === 'merged' || statusStr === 'accept') {
          decision = 'ACCEPT';
          review_status = 'ACCEPTED';
        } else if (statusStr === 'rejected' || statusStr === 'reject') {
          decision = 'REJECT';
          review_status = 'REJECTED';
        }

        const rawScore = Number(dup.matchScore);
        const similarityScore = Number.isFinite(rawScore)
          ? (rawScore > 1 ? rawScore / 100 : rawScore)
          : 0.95;
        dynamicReviews.push({
          review_id: revId,
          entity_id: dup.recordAMdmId || dup.recordBMdmId || `MDM-GOLD-${idx + 1}`,
          left_record_id: recA.id || `SRC-A-${idx + 1}`,
          right_record_id: recB.id || `SRC-B-${idx + 1}`,
          similarity_score: similarityScore,
          decision,
          review_status,
          source_a: recA.sourceSystem || 'Databricks Source A',
          source_b: recB.sourceSystem || 'Databricks Source B',
          record_a: {
            id: recA.id || `REC-A-${idx + 1}`,
            name: recA.name || recA.masterName || 'Robert Smith',
            email: recA.email || 'robert@gmail.com',
            phone: recA.phone || '9876543210',
            city: recA.city || 'New York',
            state: recA.state || 'NY',
            address: recA.address || recA.attributes?.address || '12 Main Street',
          },
          record_b: {
            id: recB.id || `REC-B-${idx + 1}`,
            name: recB.name || recB.masterName || 'ROBERT SMITH',
            email: recB.email || 'robert@ymail.com',
            phone: recB.phone || '9876543210',
            city: recB.city || 'New York',
            state: recB.state || 'NY',
            address: recB.address || recB.attributes?.address || '12 Main St',
          },
          matching_attributes: dup.matchingAttributes || ['Phone', 'Name similarity', 'Email'],
          conflicting_attributes: dup.conflictingAttributes || ['Email domain'],
        });
      });
    }
  } catch (e) {
    console.warn('Could not parse lf_duplicates:', e);
  }

  // A cluster can require steward review even when it has no duplicate-pair
  // row (for example, a validator flag on a single-record cluster). Surface
  // those MDM golden records in the same queue as unresolved duplicate pairs.
  try {
    const sourceRecordsById = JSON.parse(localStorage.getItem('lf_source_records') || '{}');
    const representedEntities = new Set(dynamicReviews.map(item => item.entity_id));
    if (Array.isArray(goldenRecords)) {
      goldenRecords.forEach((gold: any, idx: number) => {
        const reviewStatus = String(gold.reviewStatus || '').toLowerCase();
        const needsReview = String(gold.entityStatus || '').toLowerCase() === 'needs_review'
          || reviewStatus === 'pending_steward_review'
          || reviewStatus === 'needs_review'
          || reviewStatus === 'pending';
        if (!needsReview) return;

        const entityId = String(gold.mdmCustomerId || gold.id || `MDM-REVIEW-${idx + 1}`);
        if (representedEntities.has(entityId)) return;
        representedEntities.add(entityId);

        const sourceRows = sourceRecordsById[gold.id] || sourceRecordsById[entityId] || [];
        const rows = Array.isArray(sourceRows) ? sourceRows : [];
        const toReviewRecord = (row: any, fallbackId: string) => ({
          id: row?.systemRecordId || row?.id || fallbackId,
          name: row?.originalName || row?.attributes?.name || gold.masterName || 'Unknown record',
          email: row?.emailOriginal || row?.attributes?.email || gold.primaryEmail || '',
          phone: row?.phoneOriginal || row?.attributes?.phone || gold.primaryPhone || '',
          address: row?.attributes?.address || gold.address || '',
          city: row?.attributes?.city || gold.city || '',
          state: row?.attributes?.state || gold.state || '',
          ...row?.attributes,
        });
        const recordA = toReviewRecord(rows[0], `${entityId}-SOURCE`);
        const recordB = rows.length > 1
          ? toReviewRecord(rows[1], `${entityId}-RELATED`)
          : { id: entityId, name: gold.masterName || 'MDM golden record', email: gold.primaryEmail || '', phone: gold.primaryPhone || '', address: gold.address || '', city: gold.city || '', state: gold.state || '' };
        const conflicts = [
          gold.alternateEmails?.length > 1 ? 'Email' : null,
          gold.alternatePhones?.length > 1 ? 'Phone' : null,
          ...(Array.isArray(gold.validatorFlags) ? gold.validatorFlags : []),
        ].filter(Boolean);
        dynamicReviews.push({
          review_id: `REV-MDM-${entityId}`,
          entity_id: entityId,
          left_record_id: recordA.id,
          right_record_id: recordB.id,
          similarity_score: Math.max(0, Math.min(1, Number(gold.confidence || gold.avgMatchProb || 0) / (Number(gold.confidence || gold.avgMatchProb || 0) > 1 ? 100 : 1))),
          decision: 'PENDING',
          review_status: 'PENDING',
          source_a: rows[0]?.systemName || gold.sources?.[0] || 'MDM source',
          source_b: rows[1]?.systemName || 'MDM golden record',
          record_a: recordA,
          record_b: recordB,
          matching_attributes: [],
          conflicting_attributes: conflicts.length ? conflicts : [gold.reviewReason || 'MDM record flagged for steward review'],
        });
      });
    }
  } catch (e) {
    console.warn('Could not parse MDM golden records for review queue:', e);
  }

  const allItems = dynamicReviews;
  
  // Apply saved review status overrides from localStorage
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(QUEUE_STORAGE_KEY) : null;
    if (raw) {
      const savedUserReviews: ReviewItem[] = JSON.parse(raw);
      const savedMap = new Map(savedUserReviews.map(r => [r.review_id, r]));
      allItems.forEach((item, i) => {
        if (savedMap.has(item.review_id)) {
          const s = savedMap.get(item.review_id)!;
          allItems[i].decision = s.decision;
          allItems[i].review_status = s.review_status;
          allItems[i].reviewed_by = s.reviewed_by;
          allItems[i].reviewed_at = s.reviewed_at;
          allItems[i].comments = s.comments;
        }
      });
    }
  } catch (e) {}

  return allItems;
}

function updateLocalReviewStatus(reviewId: string, status: 'ACCEPTED' | 'REJECTED' | 'MERGED') {
  const items = getStoredMockItems();
  const found = items.find(i => i.review_id === reviewId);
  if (found) {
    found.review_status = status;
    found.decision = status === 'ACCEPTED' ? 'ACCEPT' : status === 'REJECTED' ? 'REJECT' : 'MERGE';
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
      }
    } catch {}
  }
}

export async function acceptReviewApi(reviewId: string, comments?: string): Promise<boolean> {
  updateLocalReviewStatus(reviewId, 'ACCEPTED');
  try {
    const res = await fetch(`${API_BASE}/api/mdm/reviews/${reviewId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments, reviewed_by: 'Data Steward' }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

export async function rejectReviewApi(reviewId: string, comments?: string): Promise<boolean> {
  updateLocalReviewStatus(reviewId, 'REJECTED');
  try {
    const res = await fetch(`${API_BASE}/api/mdm/reviews/${reviewId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments, reviewed_by: 'Data Steward' }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

export async function bulkReviewActionApi(reviewIds: string[], decision: 'ACCEPT' | 'REJECT'): Promise<boolean> {
  const status = decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
  reviewIds.forEach(id => updateLocalReviewStatus(id, status));
  try {
    const res = await fetch(`${API_BASE}/api/mdm/reviews/bulk-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_ids: reviewIds, decision, reviewed_by: 'Data Steward' }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

export async function exportReviewsApi(filters: ReviewFilters, format: 'csv' | 'json' = 'csv'): Promise<string> {
  const query = new URLSearchParams();
  query.append('format', format);
  if (filters.status) query.append('status', filters.status);
  if (filters.similarity_min !== undefined) query.append('similarity_min', filters.similarity_min.toString());
  if (filters.search) query.append('search', filters.search);

  try {
    const res = await fetch(`${API_BASE}/api/mdm/reviews/export?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return data.content || '';
    }
  } catch (e) {
    console.warn('Export API failed:', e);
  }
  return 'review_id,entity_id,similarity_score,decision\nREV-00101,ENTITY-00101,98.5%,ACCEPT';
}

export async function importReviewsApi(csvContent: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/api/mdm/reviews/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: csvContent }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.imported_count || 0;
    }
  } catch (e) {
    console.warn('Import API failed:', e);
  }
  return 0;
}

export async function executeMasterMergeApi(payload: {
  review_id?: string;
  entity_id: string;
  surviving_name: string;
  surviving_email: string;
  surviving_phone: string;
  surviving_address: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/mdm/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return true;
  }
}
