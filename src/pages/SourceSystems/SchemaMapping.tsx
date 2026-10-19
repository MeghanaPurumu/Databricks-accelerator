import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight, Sparkles, AlertCircle, CheckCircle2, HelpCircle,
  AlertTriangle, Eye, Check, X, SlidersHorizontal, RefreshCw, ShieldCheck, Database
} from 'lucide-react';
import { ColumnMapping, SourceSystem } from '../../types';
import { MasterDefinition, CanonicalAttribute } from '../../types/mdmMaster';
import { fetchSourcePreview } from '../../services/databricksApiService';

interface SchemaMappingProps {
  sources: SourceSystem[];
  master: MasterDefinition;
  onSave: (updatedSources: SourceSystem[]) => void;
  onBack: () => void;
}

// ─── Helpers for Confidence Badges ───────────────────────────────────────────
const getConfidenceInfo = (confidence?: number, targetColumn?: string) => {
  if (!targetColumn) {
    return { label: 'Unmapped', pct: 0, cls: 'bg-gray-100 text-gray-500 border-gray-200' };
  }
  const c = confidence ?? 0.95;
  const pct = Math.round(c <= 1.0 ? c * 100 : c);
  if (c >= 0.9) {
    return { label: 'High Confidence', pct, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }
  if (c >= 0.7) {
    return { label: 'Medium Confidence', pct, cls: 'bg-amber-50 text-amber-700 border-amber-100' };
  }
  return { label: 'Low Confidence', pct, cls: 'bg-red-50 text-red-600 border-red-100' };
};

const getStatusBadge = (status?: string, confidence?: number, targetColumn?: string) => {
  if (!targetColumn) {
    return { label: 'UNMAPPED', cls: 'bg-gray-100 text-gray-500' };
  }
  if (status === 'CONFIRMED') {
    return { label: 'CONFIRMED', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold' };
  }
  if (status === 'MODIFIED') {
    return { label: 'MODIFIED', cls: 'bg-purple-100 text-purple-800 border border-purple-200 font-bold' };
  }
  if ((confidence ?? 0.95) < 0.7) {
    return { label: 'NEEDS_REVIEW', cls: 'bg-red-100 text-red-800 border border-red-200 font-bold' };
  }
  return { label: 'RECOMMENDED', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium' };
};

function normalizeTargetColumn(
  rawTarget?: string,
  sourceColName?: string,
  colIndex: number = 0,
  attributes: CanonicalAttribute[] = []
): string {
  if (!attributes || attributes.length === 0) return '';

  const colToMatch = (sourceColName || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const targetToMatch = (rawTarget || '').toLowerCase().replace(/[^a-z0-9_]/g, '');

  // 1. Direct exact key or attribute name match for sourceColName
  if (colToMatch) {
    const exact = attributes.find(a =>
      a.key.toLowerCase() === colToMatch ||
      a.name.toLowerCase().replace(/\s+/g, '_') === colToMatch ||
      a.key.toLowerCase().replace(/_/g, '') === colToMatch.replace(/_/g, '')
    );
    if (exact) return exact.key;
  }

  // 2. Email matching
  if (colToMatch.includes('email') || colToMatch.includes('mail')) {
    const em = attributes.find(a => a.category === 'EMAIL' || a.key.includes('email'));
    if (em) return em.key;
  }

  // 3. Phone matching
  if (colToMatch.includes('phone') || colToMatch.includes('mobile') || colToMatch.includes('cell') || colToMatch.includes('tel')) {
    const ph = attributes.find(a => a.category === 'PHONE' || a.key.includes('phone'));
    if (ph) return ph.key;
  }

  // 4. Name matching
  if (colToMatch.includes('first') || colToMatch.includes('fname') || colToMatch.includes('given')) {
    const fn = attributes.find(a => a.key.includes('first'));
    if (fn) return fn.key;
  }
  if (colToMatch.includes('last') || colToMatch.includes('lname') || colToMatch.includes('family')) {
    const ln = attributes.find(a => a.key.includes('last'));
    if (ln) return ln.key;
  }
  if (colToMatch.includes('name') || colToMatch.includes('fullname') || colToMatch.includes('client') || colToMatch.includes('vendor') || colToMatch.includes('employee')) {
    const nm = attributes.find(a => a.category === 'NAME' || a.key.includes('name') || a.key === 'customer_name');
    if (nm) return nm.key;
  }

  // 5. Address / Location matching
  if (colToMatch.includes('addr') || colToMatch.includes('street') || colToMatch.includes('location')) {
    const ad = attributes.find(a => a.category === 'ADDRESS' || a.key.includes('address'));
    if (ad) return ad.key;
  }
  if (colToMatch.includes('city') || colToMatch.includes('town')) {
    const ct = attributes.find(a => a.key.includes('city'));
    if (ct) return ct.key;
  }
  if (colToMatch.includes('state') || colToMatch.includes('province')) {
    const st = attributes.find(a => a.key.includes('state'));
    if (st) return st.key;
  }
  if (colToMatch.includes('zip') || colToMatch.includes('postal') || colToMatch.includes('postcode')) {
    const pc = attributes.find(a => a.key.includes('postal') || a.key.includes('zip'));
    if (pc) return pc.key;
  }

  // 6. Metadata / Audit columns (data_type, decision_type, logical_field, master_column, priority_order, reason) should be UNMAPPED
  const isMetadataCol = colToMatch.includes('type') || colToMatch.includes('field') || colToMatch.includes('column') || colToMatch.includes('order') || colToMatch.includes('reason') || colToMatch.includes('action') || colToMatch.includes('status') || colToMatch.includes('decision');
  if (isMetadataCol) {
    return '';
  }

  // 7. Primary ID match (record_id / ID category) - ONLY if source column explicitly mentions id/key/code/number or is index 0
  if (
    colToMatch.includes('id') ||
    colToMatch.includes('key') ||
    colToMatch.includes('code') ||
    colToMatch.includes('num') ||
    (colIndex === 0 && (colToMatch.includes('emp') || colToMatch.includes('cust') || colToMatch.includes('user') || colToMatch.includes('id')))
  ) {
    const idAttr = attributes.find(a => a.category === 'ID' || a.required || a.key === 'record_id');
    if (idAttr) return idAttr.key;
  }

  // 8. Check rawTarget if present and valid
  if (rawTarget && rawTarget !== 'record_id' && attributes.some(a => a.key === rawTarget)) {
    return rawTarget;
  }

  // 9. Fallback to empty string (Unmapped)
  return '';
}

export default function SchemaMapping({ sources, master, onSave, onBack }: SchemaMappingProps) {
  // Clean master name to prevent "MDM MDM" duplication
  const masterTitle = master.name.replace(/\s+MDM$/i, '') + ' MDM';

  // State: per-source mappings keyed by sourceId
  const [mappingState, setMappingState] = useState<Record<string, ColumnMapping[]>>(() => {
    const initial: Record<string, ColumnMapping[]> = {};
    sources.forEach(s => {
      initial[s.sourceId] = (s.columnMappings ?? []).map((m, idx) => ({
        ...m,
        targetColumn: normalizeTargetColumn(m.targetColumn, m.sourceColumn, idx, master.canonicalAttributes)
      }));
    });
    return initial;
  });

  const [activeTableForReview, setActiveTableForReview] = useState<SourceSystem | null>(null);
  const [error, setError] = useState('');
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [filterReviewOnly, setFilterReviewOnly] = useState(false);

  // ── Auto-classify & load recommendations ────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const loadRecommendations = async () => {
      setLoadingPreviews(true);
      for (const s of sources) {
        if (s.catalog && s.schema && s.tableName) {
          try {
            const preview = await fetchSourcePreview(s.catalog, s.schema, s.tableName);
            if (!isMounted) return;
            if (preview && preview.columns) {
              setMappingState(prev => {
                const currentMaps = prev[s.sourceId] || [];
                const updated = preview.columns.map((col, idx) => {
                  const existing = currentMaps.find(m => m.sourceColumn === col.name);
                  if (existing && existing.targetColumn) {
                    return {
                      ...existing,
                      targetColumn: normalizeTargetColumn(existing.targetColumn, col.name, idx, master.canonicalAttributes)
                    };
                  }

                  const rawKey = preview.recommended_mapping[col.name] || '';
                  const targetKey = normalizeTargetColumn(rawKey, col.name, idx, master.canonicalAttributes);
                  const conf = col.confidence ?? 0.95;
                  const stat: ColumnMapping['status'] = !targetKey ? 'UNMAPPED' : (conf < 0.70 ? 'NEEDS_REVIEW' : 'RECOMMENDED');

                  return {
                    sourceColumn: col.name,
                    targetColumn: targetKey,
                    confidence: conf,
                    required: targetKey === 'record_id' || targetKey === 'id',
                    status: stat,
                  };
                });
                return { ...prev, [s.sourceId]: updated };
              });
            }
          } catch (e) {
            console.warn(`Could not load preview for ${s.tableName}:`, e);
          }
        }
      }
      if (isMounted) setLoadingPreviews(false);
    };

    loadRecommendations();
    return () => { isMounted = false; };
  }, [sources, master]);

  // ── Summary metrics calculation ─────────────────────────────────────────────
  const summary = useMemo(() => {
    let totalMappings = 0;
    let autoMapped = 0;
    let needsReviewCount = 0;
    let readyTablesCount = 0;

    const tableStats: Record<string, { totalCols: number; mappedCols: number; reviewCols: number; isReady: boolean }> = {};

    sources.forEach(s => {
      const maps = mappingState[s.sourceId] || [];
      const totalCols = maps.length;
      const mappedCols = maps.filter((m, idx) => !!normalizeTargetColumn(m.targetColumn, m.sourceColumn, idx, master.canonicalAttributes)).length;
      const reviewCols = maps.filter(m => m.targetColumn && (m.status === 'NEEDS_REVIEW' || (m.confidence ?? 0.95) < 0.70)).length;
      const isReady = reviewCols === 0;

      totalMappings += totalCols;
      autoMapped += mappedCols;
      needsReviewCount += reviewCols;
      if (isReady) readyTablesCount += 1;

      tableStats[s.sourceId] = { totalCols, mappedCols, reviewCols, isReady };
    });

    return {
      totalMappings,
      autoMapped,
      needsReviewCount,
      readyTablesCount,
      tableStats,
    };
  }, [sources, mappingState, master]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleUpdateColumnMapping = (sourceId: string, colIdx: number, newTarget: string) => {
    setMappingState(prev => {
      const current = [...(prev[sourceId] || [])];
      if (colIdx < 0 || colIdx >= current.length) return prev;

      const col = current[colIdx];
      const isUnmapped = !newTarget;
      const updatedCol: ColumnMapping = {
        ...col,
        targetColumn: newTarget,
        confidence: isUnmapped ? 0 : 1.0,
        status: isUnmapped ? 'UNMAPPED' : 'MODIFIED',
      };
      current[colIdx] = updatedCol;
      return { ...prev, [sourceId]: current };
    });
    setError('');
  };

  const handleConfirmAllHighConfidence = () => {
    setMappingState(prev => {
      const nextState: Record<string, ColumnMapping[]> = {};
      Object.entries(prev).forEach(([srcId, cols]) => {
        nextState[srcId] = cols.map(m => {
          if (m.targetColumn && (m.confidence ?? 0.95) >= 0.70) {
            const confirmedStatus: ColumnMapping['status'] = 'CONFIRMED';
            return { ...m, status: confirmedStatus };
          }
          return m;
        });
      });
      return nextState;
    });
  };

  const handleConfirmTableMappings = (sourceId: string) => {
    setMappingState(prev => {
      const current = prev[sourceId] || [];
      const updated: ColumnMapping[] = current.map(m => {
        if (m.targetColumn) {
          const confirmedStatus: ColumnMapping['status'] = 'CONFIRMED';
          return { ...m, status: confirmedStatus, confidence: Math.max(m.confidence ?? 0.95, 0.90) };
        }
        return m;
      });
      return { ...prev, [sourceId]: updated };
    });
    setActiveTableForReview(null);
  };

  const handleSaveAndStartPipeline = () => {
    setError('');

    const updatedState = { ...mappingState };

    // Auto-reconcile record_id mapping requirement if missing
    for (const s of sources) {
      const maps = updatedState[s.sourceId] ? [...updatedState[s.sourceId]] : [];
      const hasId = maps.some(m => m.targetColumn && (
        m.targetColumn === 'record_id' ||
        m.targetColumn === 'unique_id' ||
        m.targetColumn === 'id' ||
        m.targetColumn.toLowerCase().includes('id') ||
        m.targetColumn.toLowerCase().includes('key')
      ));

      if (!hasId && maps.length > 0) {
        // Find best column candidate or default first column to record_id
        const idColIndex = maps.findIndex(m =>
          m.sourceColumn.toLowerCase().includes('id') ||
          m.sourceColumn.toLowerCase().includes('key') ||
          m.sourceColumn.toLowerCase().includes('code')
        );
        const targetIdx = idColIndex >= 0 ? idColIndex : 0;
        maps[targetIdx] = {
          ...maps[targetIdx],
          targetColumn: 'record_id',
          status: 'CONFIRMED',
          required: true
        };
        updatedState[s.sourceId] = maps;
      }
    }

    setMappingState(updatedState);

    const updatedSources = sources.map(s => ({
      ...s,
      columnMappings: updatedState[s.sourceId] || s.columnMappings,
    }));
    onSave(updatedSources);
  };

  const displayedSources = filterReviewOnly
    ? sources.filter(s => !summary.tableStats[s.sourceId]?.isReady)
    : sources;

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5 max-w-6xl w-full mx-auto">
      {/* ── Top Summary Header ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 card-shadow space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                Target Master: {master.name}
              </span>
              {loadingPreviews && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <RefreshCw size={11} className="animate-spin text-indigo-500" /> Classifying schemas…
                </span>
              )}
            </div>
            <h2 className="text-[19px] font-bold text-gray-900">Schema & Column Mapping</h2>
            <p className="text-[12px] text-gray-500">
              Canonical mapping into <strong className="text-gray-800">{master.name}</strong> MDM attributes. Review low-confidence mappings before launching pipeline.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleConfirmAllHighConfidence}
              className="text-[12px] bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 size={13} className="text-emerald-600" />
              Confirm High-Confidence Mappings
            </button>
            <button
              onClick={handleSaveAndStartPipeline}
              className="text-[12px] text-white font-bold py-2 px-4 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-100"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              Confirm & Start MDM Pipeline
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Key Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-gray-100">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target Master</span>
            <p className="text-[13px] font-bold text-indigo-900 truncate">{master.name}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source Tables</span>
            <p className="text-[14px] font-bold text-gray-900">{sources.length}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Canonical Attributes</span>
            <p className="text-[14px] font-bold text-gray-900">{master.canonicalAttributes.length}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mappings Generated</span>
            <p className="text-[14px] font-bold text-emerald-700">{summary.autoMapped} / {summary.totalMappings}</p>
          </div>
          <div className={`p-3 rounded-xl border ${summary.needsReviewCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Needs Review</span>
            <p className={`text-[14px] font-bold ${summary.needsReviewCount > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
              {summary.needsReviewCount}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Table Status</span>
            <p className="text-[13px] font-bold text-emerald-700">
              Ready {summary.readyTablesCount} / {sources.length}
            </p>
          </div>
        </div>
      </div>

      {/* Target Master Attributes Pill Ribbon */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-indigo-800 uppercase tracking-wider text-[10px]">
            Target Master Attributes ({master.canonicalAttributes.length}):
          </span>
          <span className="text-indigo-600 font-mono text-[10px]">
            Target Table: {master.targetCatalog}.{master.targetSchema}.{master.targetTable}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {master.canonicalAttributes.map((attr: CanonicalAttribute) => (
            <span
              key={attr.key}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                attr.required
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}>
              {attr.name} <span className="opacity-75 font-normal">({attr.key})</span>{attr.required ? ' *' : ''}
            </span>
          ))}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-gray-100 card-shadow">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-gray-700">Registered Source Tables Summary</span>
          {summary.needsReviewCount > 0 && (
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <AlertTriangle size={12} /> {summary.needsReviewCount} mapping(s) require steward review
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterReviewOnly(f => !f)}
            className={`text-[11px] px-3 py-1.5 rounded-lg border font-semibold transition flex items-center gap-1.5 ${
              filterReviewOnly
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}>
            <SlidersHorizontal size={12} />
            {filterReviewOnly ? 'Show All Tables' : 'Show Only Review Required'}
          </button>
        </div>
      </div>

      {/* ── LEVEL 1: Source Table Summary List ────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                {['Source Table', 'Catalog / Schema', 'Columns', 'Auto Mapped', 'Review Required', 'Status', 'Action'].map(h => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayedSources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-[13px]">
                    No tables match the review filter.
                  </td>
                </tr>
              ) : (
                displayedSources.map(s => {
                  const maps = mappingState[s.sourceId] || [];
                  const stats = summary.tableStats[s.sourceId] || { totalCols: maps.length, mappedCols: maps.filter(m => m.targetColumn).length, reviewCols: 0, isReady: true };

                  return (
                    <tr key={s.sourceId} className="hover:bg-gray-50/60 transition group">
                      {/* Table Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                            {(s.sourceName || (s as any).name || s.tableName || 'SRC').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-[13px] font-bold text-gray-900 block">{s.sourceName || (s as any).name || s.tableName || 'Data Source'}</span>
                            <span className="text-[11px] font-mono text-gray-400">{s.tableName || s.fileName || (s.connectionConfig as any)?.table}</span>
                          </div>
                        </div>
                      </td>

                      {/* Catalog / Schema */}
                      <td className="px-5 py-3.5 text-[12px] text-gray-600">
                        {s.catalog ? `${s.catalog}.${s.schema}` : '—'}
                      </td>

                      {/* Columns */}
                      <td className="px-5 py-3.5 text-[12px] font-bold text-gray-700">
                        {stats.totalCols} cols
                      </td>

                      {/* Auto Mapped */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                          {stats.mappedCols} / {stats.totalCols} Mapped
                        </span>
                      </td>

                      {/* Review Required */}
                      <td className="px-5 py-3.5">
                        {stats.reviewCols > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle size={11} /> {stats.reviewCols} need review
                          </span>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> 0 pending
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        {stats.isReady ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            ✓ Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            ⚠ Review
                          </span>
                        )}
                      </td>

                      {/* Action button */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setActiveTableForReview(s)}
                          className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition flex items-center gap-1 ml-auto">
                          <Eye size={13} />
                          Review Mapping
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

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-700 font-medium">
          <AlertCircle size={15} className="shrink-0 text-red-600" />
          {error}
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-200 pb-6">
        <button
          onClick={onBack}
          className="text-[12px] text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1.5 transition px-3 py-2 rounded-lg hover:bg-gray-100">
          ← Back to Source Systems
        </button>
        <button
          onClick={handleSaveAndStartPipeline}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white shadow-md shadow-indigo-100 transition"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
          Confirm Mappings & Start MDM Pipeline
          <ArrowRight size={14} />
        </button>
      </div>

      {/* ── LEVEL 2: Detailed Mapping View Modal / Drawer ──────────────────────── */}
      {activeTableForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                  {activeTableForReview.sourceName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900">
                    {activeTableForReview.sourceName} → {masterTitle}
                  </h3>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {activeTableForReview.catalog}.{activeTableForReview.schema}.{activeTableForReview.tableName || activeTableForReview.sourceName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTableForReview(null)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X size={16} />
              </button>
            </div>

            {/* Modal Body - Mapping Table */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between text-[11px] text-gray-500 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                <span>Select target canonical attribute for each source column. Unmapped fields will be ignored.</span>
                <span className="font-bold text-indigo-700">Target Master: {master.name}</span>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="px-4 py-2.5">Source Column</th>
                      <th className="px-4 py-2.5">Target Master Attribute</th>
                      <th className="px-4 py-2.5">Confidence</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(mappingState[activeTableForReview.sourceId] || []).map((m, idx) => {
                      const confInfo = getConfidenceInfo(m.confidence, m.targetColumn);
                      const statusBadge = getStatusBadge(m.status, m.confidence, m.targetColumn);

                      return (
                        <tr key={m.sourceColumn} className="hover:bg-gray-50/50 transition">
                          {/* Source Column */}
                          <td className="px-4 py-3">
                            <span className="font-mono text-[12px] font-semibold bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg border border-gray-200">
                              {m.sourceColumn}
                            </span>
                          </td>

                          {/* Master Attribute Dropdown */}
                          <td className="px-4 py-3">
                            <select
                              value={normalizeTargetColumn(m.targetColumn, m.sourceColumn, idx, master.canonicalAttributes)}
                              onChange={e => handleUpdateColumnMapping(activeTableForReview.sourceId, idx, e.target.value)}
                              className={`w-full text-[12px] border rounded-lg px-3 py-1.5 outline-none transition bg-white
                                ${normalizeTargetColumn(m.targetColumn, m.sourceColumn, idx, master.canonicalAttributes)
                                  ? 'border-indigo-300 bg-indigo-50/30 text-indigo-900 font-semibold'
                                  : 'border-gray-200 text-gray-400'
                                }
                                focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100`}>
                              <option value="">— Unmapped / Not Required —</option>
                              {master.canonicalAttributes.map((attr: CanonicalAttribute) => (
                                <option key={attr.key} value={attr.key}>
                                  {attr.name} ({attr.key}) {attr.required ? '*' : ''}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Confidence */}
                          <td className="px-4 py-3">
                            {m.targetColumn ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${confInfo.cls}`}>
                                {confInfo.pct}% · {confInfo.label}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md ${statusBadge.cls}`}>
                              {statusBadge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <button
                onClick={() => setActiveTableForReview(null)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition">
                Close
              </button>
              <button
                onClick={() => handleConfirmTableMappings(activeTableForReview.sourceId)}
                className="px-5 py-2 rounded-xl text-[12px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm flex items-center gap-1.5">
                <Check size={14} />
                Confirm Table Mappings
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
