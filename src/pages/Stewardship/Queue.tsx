import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox, AlertTriangle, GitMerge, Sliders,
  UserCheck, Clock, CheckCircle, Search, Download, Upload,
  ChevronLeft, ChevronRight, CheckSquare, Square, Filter, RefreshCw, X, ShieldCheck,
  ChevronDown, ChevronUp, Check, Mail, Phone
} from 'lucide-react';
import {
  fetchPaginatedReviews,
  acceptReviewApi,
  rejectReviewApi,
  bulkReviewActionApi,
  exportReviewsApi,
  importReviewsApi,
  ReviewItem,
  ReviewFilters
} from '../../services/reviewApiService';
import { formatSimilarityScore } from '../../utils/formatters';
import ExcelView, { ExcelViewToggle, ExcelColumn } from '../../components/ExcelView';

export default function StewardshipQueue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [similarityRange, setSimilarityRange] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [excelView, setExcelView]       = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Expanded row
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Import Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadQueue = async () => {
    setLoading(true);
    let simMin: number | undefined = undefined;
    let simMax: number | undefined = undefined;

    if (similarityRange === '90-100') { simMin = 0.90; simMax = 1.0; }
    else if (similarityRange === '80-90') { simMin = 0.80; simMax = 0.899; }
    else if (similarityRange === '70-80') { simMin = 0.70; simMax = 0.799; }

    const filterObj: ReviewFilters = {
      page: excelView ? 1 : page,
      limit: excelView ? 10000 : limit,
      status: statusFilter,
      similarity_min: simMin,
      similarity_max: simMax,
      source: sourceFilter,
      search: searchQuery || undefined,
    };

    try {
      const data = await fetchPaginatedReviews(filterObj);
      setReviews(data.items);
      setTotalCount(data.total);
      setTotalPages(data.total_pages);
    } catch (e) {
      console.warn('Failed to load reviews:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const onReviewsChanged = () => loadQueue();
    window.addEventListener('lf_reviews_changed', onReviewsChanged);
    return () => window.removeEventListener('lf_reviews_changed', onReviewsChanged);
  }, [page, limit, statusFilter, similarityRange, sourceFilter, excelView]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadQueue();
  };

  // Actions
  const handleAccept = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReviews(prev => prev.map(r => r.review_id === id ? { ...r, review_status: 'ACCEPTED', decision: 'ACCEPT' } : r));
    await acceptReviewApi(id, 'Accepted by Data Steward');
    showToast(`✓ Match ${id} Accepted`);
    loadQueue();
  };

  const handleReject = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReviews(prev => prev.map(r => r.review_id === id ? { ...r, review_status: 'REJECTED', decision: 'REJECT' } : r));
    await rejectReviewApi(id, 'Rejected by Data Steward');
    showToast(`✓ Match ${id} Rejected`);
    loadQueue();
  };

  const handleReconcileMerge = (item: ReviewItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigate(`/stewardship/merge/${item.left_record_id}`, { state: { reviewItem: item } });
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === reviews.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reviews.map(r => r.review_id)));
    }
  };

  const handleBulkAction = async (decision: 'ACCEPT' | 'REJECT') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await bulkReviewActionApi(ids, decision);
    showToast(`✓ Bulk ${decision} applied to ${ids.length} item(s)`);
    setSelectedIds(new Set());
    loadQueue();
  };

  const handleExport = async (format: 'csv' | 'json') => {
    let simMin: number | undefined = undefined;
    let simMax: number | undefined = undefined;
    if (similarityRange === '90-100') { simMin = 0.90; simMax = 1.0; }
    else if (similarityRange === '80-90') { simMin = 0.80; simMax = 0.899; }

    const content = await exportReviewsApi({
      status: statusFilter,
      similarity_min: simMin,
      similarity_max: simMax,
      source: sourceFilter,
      search: searchQuery,
    }, format);

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mdm_review_decisions_export.${format}`;
    a.click();
    showToast(`✓ Exported ${totalCount} records to ${format.toUpperCase()}`);
  };

  const handleImportSubmit = async () => {
    if (!importText.trim()) return;
    const count = await importReviewsApi(importText);
    setImportNotice(`Successfully imported ${count} decisions into persistent backend table.`);
    setTimeout(() => {
      setShowImportModal(false);
      setImportNotice('');
      setImportText('');
      loadQueue();
    }, 1500);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const st = status.toUpperCase();
    if (st === 'ACCEPTED' || st === 'ACCEPT') return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold">✓ Accepted</span>;
    if (st === 'REJECTED' || st === 'REJECT') return <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full text-[10px] font-bold">✕ Rejected</span>;
    if (st === 'MERGED' || st === 'MERGE') return <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full text-[10px] font-bold">⚡ Merged</span>;
    return <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full text-[10px] font-bold">⏳ Pending Review</span>;
  };

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  return (
    <div className="flex-1 p-4 sm:p-6 space-y-5 overflow-y-auto flex flex-col h-full">
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-[12px] font-semibold px-4 py-2.5 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-gray-900">Duplicate Review Queue</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Server-side paginated governance queue storing persistent decisions in <strong className="text-gray-700 font-mono text-[12px]">mdm.gold.mdm_review_decisions</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition">
            <Download size={13} />
            Export CSV
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 shadow-sm transition">
            <Upload size={13} />
            Import Decisions
          </button>
        </div>
      </div>

      {/* Server-side Filter Bar */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 card-shadow space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Entity ID or Record…"
                className="w-full text-[12px] bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-xl py-2 pl-9 pr-3 outline-none transition"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500">Status:</span>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="text-[12px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none font-semibold text-gray-700 cursor-pointer">
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="MERGED">Merged</option>
              </select>
            </div>

            {/* Similarity Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500">Similarity:</span>
              <select
                value={similarityRange}
                onChange={e => { setSimilarityRange(e.target.value); setPage(1); }}
                className="text-[12px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none font-semibold text-gray-700 cursor-pointer">
                <option value="ALL">All Scores (0–100%)</option>
                <option value="90-100">90% – 100% (High)</option>
                <option value="80-90">80% – 90% (Medium)</option>
                <option value="70-80">70% – 80% (Low)</option>
              </select>
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-500">Source:</span>
              <select
                value={sourceFilter}
                onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
                className="text-[12px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none font-semibold text-gray-700 cursor-pointer">
                <option value="ALL">All Sources</option>
                <option value="CRM">CRM Customers</option>
                <option value="POS">POS Loyalty</option>
                <option value="WEB">Web Signup</option>
                <option value="Support">Support Tickets</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[12px] rounded-xl transition shadow-sm">
              Apply Filters
            </button>
            <button
              type="button"
              onClick={loadQueue}
              className="p-2 border border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 transition">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <ExcelViewToggle excelView={excelView} onToggle={() => setExcelView(!excelView)} />
          </div>
        </form>

        {/* Bulk action toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/70 border border-indigo-100 rounded-xl animate-in fade-in duration-150">
            <span className="text-[12px] font-bold text-indigo-900">
              {selectedIds.size} review candidate{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction('ACCEPT')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded-lg transition shadow-sm">
                ✓ Bulk Accept ({selectedIds.size})
              </button>
              <button
                onClick={() => handleBulkAction('REJECT')}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-[11px] rounded-lg transition shadow-sm">
                ✕ Bulk Reject ({selectedIds.size})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Excel View */}
      {excelView && (
        <div className="flex-1 flex flex-col">
          <div className="bg-[#1d6f42] text-[#c6efce] text-[11px] font-semibold px-4 py-2 rounded-t-2xl flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#c6efce" /><text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1d6f42" fontFamily="Arial">X</text></svg>
            Microsoft Excel — Governance Review Queue ({reviews.length} items)
          </div>
          <ExcelView<ReviewItem>
            columns={[
              { label: 'Review ID', key: 'review_id', sortable: true, minWidth: 100, render: r => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>{r.review_id}</span> },
              { label: 'Left Record Name', minWidth: 150, render: r => <span style={{ fontWeight: 600 }}>{r.record_a?.name || (r as any).left_record_name || r.left_record_id || '—'}</span> },
              { label: 'Left Email', minWidth: 170, render: r => {
                const email = r.record_a?.email || (r as any).left_record_email || '';
                return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{email && email.includes('@') ? email : '—'}</span>;
              } },
              { label: 'Right Record Name', minWidth: 150, render: r => <span style={{ fontWeight: 600 }}>{r.record_b?.name || (r as any).right_record_name || r.right_record_id || '—'}</span> },
              { label: 'Right Email', minWidth: 170, render: r => {
                const email = r.record_b?.email || (r as any).right_record_email || '';
                return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{email && email.includes('@') ? email : '—'}</span>;
              } },
              { label: 'Similarity Score', key: 'similarity_score', sortable: true, minWidth: 110, render: r => <span style={{ fontWeight: 700, color: r.similarity_score >= 0.9 ? '#059669' : r.similarity_score >= 0.75 ? '#d97706' : '#dc2626' }}>{formatSimilarityScore(r.similarity_score)}</span> },
              { label: 'Status', key: 'review_status', minWidth: 100, render: r => {
                const st = r.review_status || r.decision || (r as any).status || 'PENDING';
                const color = st === 'ACCEPTED' || st === 'ACCEPT' || st === 'MERGED' ? '#059669' : st === 'REJECTED' || st === 'REJECT' ? '#dc2626' : '#d97706';
                return <span style={{ fontWeight: 600, color }}>{st}</span>;
              } },
              { label: 'Actions', minWidth: 160, align: 'center' as const, render: r => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={(e) => handleAccept(r.review_id, e)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Accept</button>
                  <button onClick={(e) => handleReject(r.review_id, e)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                </div>
              )}
            ] as ExcelColumn<ReviewItem>[]}
            data={reviews}
            loading={loading}
            rowKey={r => r.review_id}
            emptyMessage="No review items match filters"
            maxHeight="calc(100vh - 280px)"
          />
        </div>
      )}

      {/* Review Queue Table */}
      {!excelView && (
      <>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <RefreshCw size={22} className="animate-spin text-indigo-500" />
            <span className="text-[13px]">Querying server-side review queue…</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
            <h3 className="text-[15px] font-bold text-gray-900">No Pending Duplicate Reviews</h3>
            <p className="text-[12px] text-gray-400 mt-1 max-w-sm mx-auto">
              All record pairs matching the active filter criteria have been reviewed or reconciled.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  {/* Checkbox */}
                  <th className="px-4 py-3 w-8">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-indigo-600 transition">
                      {selectedIds.size === reviews.length && reviews.length > 0
                        ? <CheckSquare size={15} className="text-indigo-600" />
                        : <Square size={15} />}
                    </button>
                  </th>
                  {['Review ID', 'Record A', 'Record B', 'Matching', 'Conflicts', 'Similarity', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reviews.map(item => {
                  const isSelected = selectedIds.has(item.review_id);
                  const isExpanded = expandedRow === item.review_id;
                  const pct = Math.round((item.similarity_score || 0) * 100);
                  const scoreColor = pct >= 90 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : pct >= 75 ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-red-700 bg-red-50 border-red-200';

                  return (
                    <React.Fragment key={item.review_id}>
                      <tr
                        className={`cursor-pointer transition group ${
                          isSelected ? 'bg-indigo-50/30' : isExpanded ? 'bg-indigo-50/20 border-l-4 border-indigo-500' : 'hover:bg-gray-50/60'
                        }`}
                        onClick={() => setExpandedRow(isExpanded ? null : item.review_id)}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <button onClick={e => toggleSelect(item.review_id, e)} className="text-gray-400 hover:text-indigo-600 transition">
                            {isSelected ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} />}
                          </button>
                        </td>

                        {/* Review ID */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <button className="h-5 w-5 rounded flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition">
                              {isExpanded ? <ChevronUp size={12} className="text-indigo-600" /> : <ChevronDown size={12} />}
                            </button>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-indigo-600 font-mono">{item.review_id}</span>
                              <span className="text-[10px] text-gray-400 font-mono">{item.entity_id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Record A */}
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[12px] font-bold text-gray-900">{item.record_a?.name || item.left_record_id}</span>
                            <span className="text-[10px] text-indigo-500 font-medium">{item.source_a}</span>
                            {item.record_a?.email && item.record_a.email.includes('@') && (
                              <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <Mail size={8} className="text-blue-400" />{item.record_a.email}
                              </span>
                            )}
                            {item.record_a?.phone && (
                              <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <Phone size={8} className="text-purple-400" />{item.record_a.phone}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Record B */}
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[12px] font-bold text-gray-900">{item.record_b?.name || item.right_record_id}</span>
                            <span className="text-[10px] text-indigo-500 font-medium">{item.source_b}</span>
                            {item.record_b?.email && item.record_b.email.includes('@') && (
                              <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <Mail size={8} className="text-blue-400" />{item.record_b.email}
                              </span>
                            )}
                            {item.record_b?.phone && (
                              <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <Phone size={8} className="text-purple-400" />{item.record_b.phone}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Matching fields */}
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[140px]">
                            {(item.matching_attributes || []).slice(0, 3).map((m: string) => (
                              <span key={m} className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Check size={8} />{m}
                              </span>
                            ))}
                            {(item.matching_attributes || []).length > 3 && (
                              <span className="text-[9px] text-gray-400">+{item.matching_attributes.length - 3}</span>
                            )}
                          </div>
                        </td>

                        {/* Conflicting fields */}
                        <td className="px-3 py-3">
                          {!(item.conflicting_attributes?.length) ? (
                            <span className="text-[10px] text-gray-300 italic">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[120px]">
                              {item.conflicting_attributes.slice(0, 2).map((c: string) => (
                                <span key={c} className="text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                                  ⚠ {c}
                                </span>
                              ))}
                              {item.conflicting_attributes.length > 2 && (
                                <span className="text-[9px] text-gray-400">+{item.conflicting_attributes.length - 2}</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Similarity */}
                        <td className="px-3 py-3">
                          <span className={`text-[12px] font-extrabold px-2.5 py-0.5 rounded-lg border ${scoreColor}`}>
                            {pct}%
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <StatusBadge status={item.review_status} />
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={e => handleAccept(item.review_id, e)}
                              className="h-7 px-2.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1 whitespace-nowrap">
                              <Check size={11} /> Accept
                            </button>
                            <button
                              onClick={e => handleReject(item.review_id, e)}
                              className="h-7 px-2.5 text-[10px] font-bold border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg transition whitespace-nowrap">
                              ✕ Reject
                            </button>
                            <button
                              onClick={e => handleReconcileMerge(item, e)}
                              className="h-7 px-2.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1 whitespace-nowrap">
                              <GitMerge size={11} /> Merge
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded Detail Row ── */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/10">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm space-y-3">
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <GitMerge size={11} className="text-indigo-500" />
                                Attribute Comparison — {item.source_a} vs {item.source_b}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-[11px]">
                                  <thead>
                                    <tr className="border-b border-gray-100">
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase w-28">Field</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-indigo-500 uppercase">
                                        {item.source_a} <span className="font-normal text-gray-400 text-[9px]">({item.left_record_id})</span>
                                      </th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-indigo-500 uppercase">
                                        {item.source_b} <span className="font-normal text-gray-400 text-[9px]">({item.right_record_id})</span>
                                      </th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase">Result</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {[
                                      { field: 'Name',    a: item.record_a?.name,    b: item.record_b?.name },
                                      { field: 'Email',   a: item.record_a?.email,   b: item.record_b?.email },
                                      { field: 'Phone',   a: item.record_a?.phone,   b: item.record_b?.phone },
                                      { field: 'Address', a: item.record_a?.address, b: item.record_b?.address },
                                    ].map(({ field, a, b }) => {
                                      const matchKey = field.toLowerCase();
                                      const isMatch = (item.matching_attributes || []).map((s: string) => s.toLowerCase()).includes(matchKey);
                                      const isConflict = (item.conflicting_attributes || []).map((s: string) => s.toLowerCase()).includes(matchKey);
                                      const rowBg = isMatch ? 'bg-emerald-50/40' : isConflict ? 'bg-amber-50/40' : '';
                                      return (
                                        <tr key={field} className={`${rowBg} hover:bg-gray-50/50 transition`}>
                                          <td className="px-3 py-2 font-bold text-gray-600">{field}</td>
                                          <td className="px-3 py-2 font-mono text-gray-800">{String(a || '—')}</td>
                                          <td className="px-3 py-2 font-mono text-gray-800">{String(b || '—')}</td>
                                          <td className="px-3 py-2">
                                            {isMatch ? (
                                              <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                                                <Check size={9} /> Match
                                              </span>
                                            ) : isConflict ? (
                                              <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded w-fit">⚠ Conflict</span>
                                            ) : <span className="text-[9px] text-gray-300">—</span>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                <button onClick={e => handleAccept(item.review_id, e)}
                                  className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-4 rounded-xl transition flex items-center gap-1.5">
                                  <Check size={11} /> Accept Match
                                </button>
                                <button onClick={e => handleReject(item.review_id, e)}
                                  className="text-[11px] border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold py-1.5 px-4 rounded-xl transition">
                                  ✕ Reject
                                </button>
                                <button onClick={e => handleReconcileMerge(item, e)}
                                  className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-4 rounded-xl transition flex items-center gap-1.5 ml-auto">
                                  <GitMerge size={11} /> Full Reconciliation →
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Legend */}
        {reviews.length > 0 && !loading && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex items-center justify-between text-[11px] text-gray-500">
            <span>Showing {reviews.length} of {totalCount.toLocaleString()} review pairs — click any row to expand</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block"></span> Match</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block"></span> Conflict</span>
            </div>
          </div>
        )}
      </div>

      {/* Server-Side Pagination Footer */}
      <div className="bg-white border border-gray-100 rounded-2xl px-5 py-3.5 card-shadow flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] text-gray-500">
          <span>
            Showing <strong className="text-gray-900 font-semibold">{totalCount > 0 ? startRecord : 0}–{endRecord}</strong> of <strong className="text-gray-900 font-semibold">{totalCount.toLocaleString()}</strong> records
          </span>
          <select
            value={limit}
            onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
            className="text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 font-semibold text-gray-700 outline-none">
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1">
            <ChevronLeft size={14} /> Prev
          </button>

          <span className="text-[12px] font-semibold text-gray-700 px-3">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 text-[12px] font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1">
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
      </>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-[15px] font-bold text-gray-900">Import Review Decisions (CSV Template)</h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            
            <p className="text-[12px] text-gray-500 leading-relaxed">
              Paste CSV decision content below. Must contain <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600 font-mono text-[11px]">review_id,decision,comments</code> columns.
            </p>

            <textarea
              rows={6}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="review_id,decision,comments&#10;REV-00101,ACCEPT,Confirmed matching identity&#10;REV-00102,REJECT,Different customer"
              className="w-full text-[12px] font-mono bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-400 focus:bg-white transition"
            />

            {importNotice && (
              <div className="text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                ✓ {importNotice}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm">
                Upload & Process Decisions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
