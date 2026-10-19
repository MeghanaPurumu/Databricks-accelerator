import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, Search, ChevronLeft, ChevronRight, Eye,
  RefreshCw, Zap, CheckCircle2, Play, Mail, Phone,
  ShieldCheck, AlertTriangle, HelpCircle, Tag, RotateCcw,
  ChevronDown, ChevronUp, Layers, ExternalLink, Database, MapPin, User
} from 'lucide-react';
import { mockMasterDataService, populateGoldenRecordsFromSources, getLocalStorageData, rollbackPipelineRun } from '../../services/masterDataService';
import { mockMatchingService } from '../../services/matchingService';
import { GoldenRecord, SourceSystem, SourceRecord } from '../../types';
import ExcelView, { ExcelViewToggle, ExcelColumn } from '../../components/ExcelView';

// ─── Entity Status Badge ────────────────────────────────────────────────────
const EntityStatusBadge = ({ status }: { status?: string }) => {
  const cfg: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    matched:      { label: 'Matched',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', Icon: ShieldCheck },
    unmatched:    { label: 'Unmatched',  cls: 'bg-gray-100 text-gray-500 border-gray-200',         Icon: HelpCircle },
    needs_review: { label: 'Review',     cls: 'bg-amber-50 text-amber-700 border-amber-100',       Icon: AlertTriangle },
  };
  const { label, cls, Icon } = cfg[status ?? 'unmatched'] ?? cfg.unmatched;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      <Icon size={9} />
      {label}
    </span>
  );
};

// ─── Quality Score Bar ──────────────────────────────────────────────────────
const QualityBar = ({ score }: { score: number }) => {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-bold ${pct >= 85 ? 'text-emerald-700' : pct >= 65 ? 'text-amber-600' : 'text-red-600'}`}>
        {pct}%
      </span>
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function GoldenRecords() {
  const navigate = useNavigate();
  const [loading, setLoading]           = useState(true);
  const [records, setRecords]           = useState<GoldenRecord[]>([]);
  const [total, setTotal]               = useState(0);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [excelView, setExcelView]       = useState(false);
  const [page, setPage]                 = useState(1);
  const [pendingCount, setPendingCount] = useState(0);
  const [publishing, setPublishing]     = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [rollbackSuccess, setRollbackSuccess] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, SourceRecord[]>>({});
  const [openDropdown, setOpenDropdown] = useState<{ recordId: string; type: 'email' | 'phone' | 'attrs' } | null>(null);

  const PAGE_SIZE = 10;

  const load = async () => {
    setLoading(true);
    try {
      const res = await mockMasterDataService.getGoldenRecords({
        search,
        entityStatus: filterStatus || undefined,
        page: excelView ? 1 : page,
        pageSize: excelView ? 10000 : PAGE_SIZE,
      });
      setRecords(res.records);
      setTotal(res.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, filterStatus, page, excelView]);

  useEffect(() => {
    mockMatchingService.getPotentialDuplicates().then(dups => setPendingCount(dups.length));
  }, []);

  // Close any open dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = () => setOpenDropdown(null);
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [openDropdown]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const sources = getLocalStorageData<SourceSystem[]>('lf_source_systems', []);
      if (sources.length > 0) {
        await populateGoldenRecordsFromSources(sources);
      }
    } catch (err) {
      console.error('Failed to publish golden records:', err);
    } finally {
      setTimeout(async () => {
        setPublishing(false);
        setPublishSuccess(true);
        await load();
        mockMatchingService.getPotentialDuplicates().then(dups => setPendingCount(dups.length));
        setTimeout(() => setPublishSuccess(false), 4000);
      }, 800);
    }
  };

  const handleRollback = async () => {
    rollbackPipelineRun();
    setShowRollbackConfirm(false);
    setRollbackSuccess(true);
    await load();
    setPendingCount(0);
    setTimeout(() => setRollbackSuccess(false), 4000);
  };

  const domainRoute = (rec: GoldenRecord) => {
    if (rec.id || rec.mdmCustomerId) {
      navigate(`/master-data/customer/${rec.id || rec.mdmCustomerId}`);
    } else {
      mockMasterDataService.getRecords('customer', { search: rec.masterName }).then(res => {
        if (res.records.length > 0) navigate(`/master-data/customer/${res.records[0].id}`);
        else navigate('/master-data/customer');
      });
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Award size={18} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Golden Records Registry</h2>
            <p className="text-[12px] text-gray-400">
              {total.toLocaleString()} authoritative customer profiles resolved across all source systems.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowRollbackConfirm(true)}
            title="Rollback generated golden records"
            className="text-[12px] bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw size={13} />
            <span>Rollback Pipeline</span>
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="text-[12px] bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-amber-200"
          >
            {publishing
              ? <><RefreshCw size={13} className="animate-spin" /><span>Running Pipeline...</span></>
              : <><Play size={13} fill="currentColor" /><span>Publish Golden Records</span></>
            }
          </button>
        </div>
      </div>

      {/* Pending duplicates banner */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-500 animate-pulse" />
              <span className="text-[12px] font-bold text-amber-800">Human-in-the-Loop Verification Required</span>
            </div>
            <p className="text-[11px] text-amber-600 max-w-2xl">
              {pendingCount} candidate duplicate pairs need steward review before the next golden record publish.
            </p>
          </div>
          <button onClick={() => navigate('/stewardship/duplicates')}
            className="text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-4 rounded-xl transition whitespace-nowrap">
            Resolve Duplicates
          </button>
        </div>
      )}

      {publishSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-[12px] font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span>Pipeline executed! Golden Records Registry has been published.</span>
        </div>
      )}

      {rollbackSuccess && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[12px] font-bold text-amber-800 flex items-center gap-2 animate-in fade-in duration-200">
          <RotateCcw size={16} className="text-amber-600" />
          <span>Pipeline data rolled back. Golden Records Registry has been reset.</span>
        </div>
      )}

      {/* Rollback Confirmation Modal */}
      {showRollbackConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Rollback Golden Records</h3>
                <p className="text-[12px] text-gray-500">Reset MDM data back to clean state</p>
              </div>
            </div>
            <p className="text-[13px] text-gray-600">
              Are you sure you want to rollback the pipeline run and clear the current Golden Records registry?
            </p>
            <div className="text-[12px] text-red-700 bg-red-50 p-3 rounded-xl border border-red-100 space-y-1">
              <p className="font-semibold">This action will:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-600">
                <li>Purge all current Golden Records from the registry</li>
                <li>Reset Master customer clusters and duplicate review items</li>
                <li>Keep registered Databricks source schemas so you can re-run at any time</li>
              </ul>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRollbackConfirm(false)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleRollback}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 transition shadow-sm flex items-center gap-1.5">
                <RotateCcw size={13} />
                Yes, Rollback Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, MDM ID, or email..."
            className="w-full text-[13px] bg-gray-50 border border-gray-200 focus:border-amber-300 rounded-lg py-1.5 pl-8 pr-4 text-gray-700 placeholder-gray-400 outline-none transition"
          />
        </div>
        {/* Entity status filter */}
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-gray-600 outline-none focus:border-amber-300 transition"
        >
          <option value="">All Statuses</option>
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
          <option value="needs_review">Needs Review</option>
        </select>
        {(search || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setPage(1); }}
            className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition">
            <RefreshCw size={11} /> Reset
          </button>
        )}
        <div className="ml-auto">
          <ExcelViewToggle excelView={excelView} onToggle={() => setExcelView(!excelView)} />
        </div>
      </div>

      {/* Excel View */}
      {excelView && (
        <div className="flex-1 flex flex-col">
          <div className="bg-[#1d6f42] text-[#c6efce] text-[11px] font-semibold px-4 py-2 rounded-t-2xl flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#c6efce" /><text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1d6f42" fontFamily="Arial">X</text></svg>
            Microsoft Excel — Golden Records Registry ({records.length} records)
          </div>
          <ExcelView<GoldenRecord>
            columns={[
              { label: 'MDM ID', key: 'id', sortable: true, minWidth: 110, render: r => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#d97706' }}>{r.id}</span> },
              { label: 'Master Name', key: 'masterName', sortable: true, minWidth: 160, render: r => <span style={{ fontWeight: 600 }}>{r.masterName}</span> },
              { label: 'Primary Email', minWidth: 180, render: r => <span style={{ color: '#374151', fontFamily: 'monospace' }}>{r.primaryEmail && r.primaryEmail.includes('@') ? r.primaryEmail : '—'}</span> },
              { label: 'Primary Phone', minWidth: 130, render: r => <span style={{ color: '#374151' }}>{r.primaryPhone || '—'}</span> },
              { label: 'Source Systems', minWidth: 160, render: r => {
                if (!r.sources || r.sources.length === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
                const names = (r.sources as any[]).map((s: any) => typeof s === 'string' ? s : (s?.systemName || s?.sourceName || s?.name)).filter(Boolean);
                return <span style={{ color: '#4b5563', fontWeight: 600 }}>{names.length > 0 ? names.join(', ') : '—'}</span>;
              } },
              { label: 'Quality Score', key: 'qualityScore', sortable: true, minWidth: 110, render: r => {
                const q = r.qualityScore ?? 95;
                const color = q >= 90 ? '#059669' : q >= 75 ? '#d97706' : '#dc2626';
                return <span style={{ fontWeight: 700, color }}>{q.toFixed(1)}%</span>;
              } },
              { label: 'Entity Status', key: 'entityStatus', minWidth: 110, render: r => <span style={{ fontWeight: 600, color: r.entityStatus === 'matched' ? '#059669' : r.entityStatus === 'needs_review' ? '#d97706' : '#6b7280' }}>{(r.entityStatus || 'unmatched').replace(/_/g, ' ')}</span> },
              { label: 'Confidence Score', key: 'confidence', minWidth: 120, render: r => {
                const c = r.confidence ?? (r as any).confidenceScore;
                if (c === undefined || c === null) return <span style={{ color: '#9ca3af' }}>—</span>;
                const val = c <= 1.0 ? c * 100 : c;
                return <span style={{ fontWeight: 700, color: val >= 90 ? '#059669' : '#d97706' }}>{val.toFixed(1)}%</span>;
              } },
              { label: 'Last Updated', key: 'lastUpdated', minWidth: 130, render: r => <span style={{ color: '#9ca3af', fontSize: 11 }}>{r.lastUpdated?.substring(0, 10) || '—'}</span> },
            ] as ExcelColumn<GoldenRecord>[]}
            data={records}
            loading={loading}
            onRowClick={r => domainRoute(r)}
            rowKey={r => r.id}
            emptyMessage="No golden records found — try re-running the publish pipeline"
            maxHeight="calc(100vh - 280px)"
          />
        </div>
      )}

      {/* Normal Table */}
      {!excelView && (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden min-h-[300px]">

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                {['MDM ID', 'Entity Name', 'Primary Contact', 'Alt Contacts', 'Sources', 'Quality', 'Status', 'Confidence', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-3.5 skeleton rounded" style={{ width: `${50 + j * 12}px` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Award size={24} className="text-gray-200" />
                      <p className="text-[13px] font-semibold text-gray-400">No golden records found</p>
                    </div>
                  </td>
                </tr>
              ) : records.map(rec => {
                const altEmailCount = Array.isArray(rec.alternateEmails) ? rec.alternateEmails.length : 0;
                const altPhoneCount = Array.isArray(rec.alternatePhones) ? rec.alternatePhones.length : 0;
                const hasAddress = !!(rec.address || rec.city || rec.state);
                const isExpanded = expandedRecordId === rec.id;

                const handleToggleExpand = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (isExpanded) {
                    setExpandedRecordId(null);
                  } else {
                    setExpandedRecordId(rec.id);
                    if (!expandedSources[rec.id]) {
                      try {
                        const srcList = await mockMasterDataService.getSourceRecords(rec.id);
                        setExpandedSources(prev => ({ ...prev, [rec.id]: srcList }));
                      } catch (err) {
                        console.error('Error fetching source records:', err);
                      }
                    }
                  }
                };

                const srcRecordsForRec = expandedSources[rec.id] || [];

                return (
                  <React.Fragment key={rec.id}>
                    <tr onClick={handleToggleExpand}
                      className={`transition cursor-pointer group ${isExpanded ? 'bg-amber-50/60 border-l-4 border-amber-500' : 'hover:bg-amber-50/30'}`}>
                      {/* MDM ID + Expand Chevron */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleToggleExpand}
                            className="h-5 w-5 rounded flex items-center justify-center text-gray-400 hover:text-amber-700 hover:bg-amber-100 transition"
                            title={isExpanded ? "Collapse multi-source details" : "Expand multi-source details"}
                          >
                            {isExpanded ? <ChevronUp size={13} className="text-amber-600" /> : <ChevronDown size={13} />}
                          </button>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-bold text-amber-600 font-mono">
                              {rec.mdmCustomerId || rec.id.replace('GOLD-CUST-', 'MDM')}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {rec.sourceRecordsCount} src records ({rec.sources.length} sources)
                            </span>
                          </div>
                        </div>
                      </td>
                      {/* Entity Name */}
                      <td className="px-4 py-3.5">
                        <span className="text-[13px] font-semibold text-gray-900">{rec.masterName}</span>
                      </td>
                      {/* Primary Contact with Interactive Dropdown for Multiple Mail IDs & Phones */}
                      <td className="px-4 py-3.5 relative" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                          {/* Email Section */}
                          {rec.primaryEmail && (
                            <div className="relative">
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-700">
                                <Mail size={10} className="text-blue-500 flex-shrink-0" />
                                <span className="font-medium truncate max-w-[130px] font-mono">{rec.primaryEmail}</span>
                                {altEmailCount > 0 && (
                                  <button
                                    onClick={() => setOpenDropdown(prev => prev?.recordId === rec.id && prev?.type === 'email' ? null : { recordId: rec.id, type: 'email' })}
                                    className="text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 transition cursor-pointer"
                                    title="View all associated email IDs across source systems"
                                  >
                                    <span>{altEmailCount} email{altEmailCount > 1 ? 's' : ''}</span>
                                    <ChevronDown size={8} />
                                  </button>
                                )}
                              </div>

                              {/* Floating Email Dropdown Menu */}
                              {openDropdown?.recordId === rec.id && openDropdown?.type === 'email' && (
                                <div className="absolute left-0 top-full mt-1.5 z-40 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95">
                                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                      <Mail size={10} className="text-blue-500" />
                                      All Mail IDs — Across Sources ({altEmailCount})
                                    </span>
                                    <button
                                      onClick={() => setOpenDropdown(null)}
                                      className="text-[10px] text-gray-400 hover:text-gray-600 font-bold px-1 rounded"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                    {rec.alternateEmails?.map((item, idx) => (
                                      <div
                                        key={idx}
                                        className="p-2.5 rounded-lg bg-gray-50/80 hover:bg-blue-50/50 border border-gray-100 flex items-start justify-between gap-2 text-[11px]"
                                      >
                                        <div className="flex flex-col min-w-0 gap-0.5">
                                          <span className="font-mono font-semibold text-gray-800 truncate">{item.email}</span>
                                          <span className="text-[9px] text-blue-500 font-medium">from: {item.source}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                          {item.is_primary ? (
                                            <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded">✓ Primary</span>
                                          ) : (
                                            <span className="text-[8px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded">Alternate</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Phone Section */}
                          {rec.primaryPhone && (
                            <div className="relative">
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                <Phone size={10} className="text-purple-500 flex-shrink-0" />
                                <span className="font-mono">{rec.primaryPhone}</span>
                                {altPhoneCount > 0 && (
                                  <button
                                    onClick={() => setOpenDropdown(prev => prev?.recordId === rec.id && prev?.type === 'phone' ? null : { recordId: rec.id, type: 'phone' })}
                                    className="text-[9px] bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 transition cursor-pointer"
                                    title="View all associated phone numbers across source systems"
                                  >
                                    <span>{altPhoneCount} phone{altPhoneCount > 1 ? 's' : ''}</span>
                                    <ChevronDown size={8} />
                                  </button>
                                )}
                              </div>

                              {/* Floating Phone Dropdown Menu */}
                              {openDropdown?.recordId === rec.id && openDropdown?.type === 'phone' && (
                                <div className="absolute left-0 top-full mt-1.5 z-40 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95">
                                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                      <Phone size={10} className="text-purple-500" />
                                      All Phone Numbers — Across Sources ({altPhoneCount})
                                    </span>
                                    <button
                                      onClick={() => setOpenDropdown(null)}
                                      className="text-[10px] text-gray-400 hover:text-gray-600 font-bold px-1 rounded"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                    {rec.alternatePhones?.map((item, idx) => (
                                      <div
                                        key={idx}
                                        className="p-2.5 rounded-lg bg-gray-50/80 hover:bg-purple-50/50 border border-gray-100 flex items-start justify-between gap-2 text-[11px]"
                                      >
                                        <div className="flex flex-col min-w-0 gap-0.5">
                                          <span className="font-mono font-semibold text-gray-800">{item.phone}</span>
                                          <span className="text-[9px] text-purple-500 font-medium">from: {item.source}</span>
                                        </div>
                                        {item.is_primary ? (
                                          <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded mt-0.5">✓ Primary</span>
                                        ) : (
                                          <span className="text-[8px] font-bold bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded mt-0.5">Alternate</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Alt Contacts & Attributes Column with Dropdown Triggers */}
                      <td className="px-4 py-3.5 relative" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {altEmailCount > 0 && (
                            <button
                              onClick={() => setOpenDropdown(prev => prev?.recordId === rec.id && prev?.type === 'email' ? null : { recordId: rec.id, type: 'email' })}
                              className="inline-flex items-center gap-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold transition cursor-pointer"
                              title="Click to view all email IDs across source systems"
                            >
                              <Mail size={9} />
                              <span>{altEmailCount} email{altEmailCount > 1 ? 's' : ''}</span>
                              <ChevronDown size={8} />
                            </button>
                          )}
                          {altPhoneCount > 0 && (
                            <button
                              onClick={() => setOpenDropdown(prev => prev?.recordId === rec.id && prev?.type === 'phone' ? null : { recordId: rec.id, type: 'phone' })}
                              className="inline-flex items-center gap-1 text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-bold transition cursor-pointer"
                              title="Click to view all phone numbers across source systems"
                            >
                              <Phone size={9} />
                              <span>{altPhoneCount} phone{altPhoneCount > 1 ? 's' : ''}</span>
                              <ChevronDown size={8} />
                            </button>
                          )}
                          {hasAddress && (
                            <div className="relative">
                              <button
                                onClick={() => setOpenDropdown(prev => prev?.recordId === rec.id && prev?.type === 'attrs' ? null : { recordId: rec.id, type: 'attrs' })}
                                className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold transition cursor-pointer"
                                title="Click to view other attributes (address, location, etc.)"
                              >
                                <MapPin size={9} />
                                <span>Attrs</span>
                                <ChevronDown size={8} />
                              </button>
                              {/* Floating Attributes Dropdown */}
                              {openDropdown?.recordId === rec.id && openDropdown?.type === 'attrs' && (
                                <div className="absolute left-0 top-full mt-1.5 z-40 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-2.5 space-y-2 animate-in fade-in-50 zoom-in-95">
                                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                      <Tag size={10} className="text-emerald-500" />
                                      Other Attributes
                                    </span>
                                    <button
                                      onClick={() => setOpenDropdown(null)}
                                      className="text-[10px] text-gray-400 hover:text-gray-600 font-bold px-1 rounded"
                                    >✕</button>
                                  </div>
                                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                                    {rec.address && (
                                      <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-100 text-[11px]">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-0.5 flex items-center gap-1"><MapPin size={9} className="text-emerald-500" /> Address</div>
                                        <span className="font-medium text-gray-800">{rec.address}</span>
                                      </div>
                                    )}
                                    {(rec.city || rec.state) && (
                                      <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-100 text-[11px]">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">City / State</div>
                                        <span className="font-medium text-gray-800">{[rec.city, rec.state].filter(Boolean).join(', ')}</span>
                                      </div>
                                    )}
                                    {rec.dob && (
                                      <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-100 text-[11px]">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Date of Birth</div>
                                        <span className="font-medium text-gray-800">{rec.dob}</span>
                                      </div>
                                    )}
                                    {rec.sources.length > 0 && (
                                      <div className="p-2.5 rounded-lg bg-gray-50/80 border border-gray-100 text-[11px]">
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Contributing Source Systems</div>
                                        <div className="flex flex-wrap gap-1">
                                          {rec.sources.map((s, sI) => (
                                            <span key={sI} className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">{s}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {altEmailCount === 0 && altPhoneCount === 0 && !hasAddress && (
                            <span className="text-[11px] text-gray-300">—</span>
                          )}
                        </div>
                      </td>
                      {/* Sources */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {rec.sources.map((s, sIdx) => {
                            const colors = [
                              'bg-indigo-50 text-indigo-700 border-indigo-100',
                              'bg-cyan-50 text-cyan-700 border-cyan-100',
                              'bg-emerald-50 text-emerald-700 border-emerald-100',
                              'bg-purple-50 text-purple-700 border-purple-100',
                            ];
                            const clr = colors[sIdx % colors.length];
                            return (
                              <span key={s} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${clr}`}>
                                {s.split(' ')[0]}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      {/* Quality */}
                      <td className="px-4 py-3.5">
                        <QualityBar score={rec.qualityScore} />
                      </td>
                      {/* Entity Status */}
                      <td className="px-4 py-3.5">
                        <EntityStatusBadge status={rec.entityStatus} />
                      </td>
                      {/* Confidence */}
                      <td className="px-4 py-3.5">
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                          {rec.confidence}%
                        </span>
                      </td>
                      {/* Action */}
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => domainRoute(rec)}
                            title="Open Master Record 360 View"
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDABLE MULTI-SOURCE & ATTRIBUTE BREAKDOWN DRAWER */}
                    {isExpanded && (
                      <tr className="bg-amber-50/20 border-b border-amber-100">
                        <td colSpan={9} className="p-4 sm:p-5">
                          <div className="bg-white border border-amber-200/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
                            
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-gray-100">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                                  <Layers size={18} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-[14px] font-bold text-gray-900">{rec.masterName}</h3>
                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                                      Unified Customer 360
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-400">
                                    Resolved across <strong className="text-gray-700 font-semibold">{rec.sources.length} Source Systems</strong> ({rec.sources.join(', ')}) with {rec.sourceRecordsCount} contributing raw records.
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => domainRoute(rec)}
                                className="text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                              >
                                <span>Open Full 360° Profile & Lineage</span>
                                <ExternalLink size={12} />
                              </button>
                            </div>

                            {/* Section 1: Contributing Source Systems Cards */}
                            <div>
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Contributing Source Systems</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                {rec.sources.map((srcName, sIdx) => {
                                  const matchingRaw = srcRecordsForRec.filter(sr => sr.systemName === srcName);
                                  const count = matchingRaw.length || 1;
                                  return (
                                    <div key={srcName} className="p-3 bg-gray-50/80 border border-gray-100 rounded-xl space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[12px] font-bold text-gray-800 flex items-center gap-1.5">
                                          <Database size={12} className="text-indigo-500" />
                                          {srcName}
                                        </span>
                                        <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                                          {count} record{count > 1 ? 's' : ''}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-gray-400 font-mono truncate">
                                        {matchingRaw.map(sr => `#${sr.systemRecordId}`).join(', ') || `Priority ${sIdx + 1}`}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Section 2: All Discovered Attributes & Mail IDs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                              {/* All Emails */}
                              <div className="p-3 bg-gray-50/60 border border-gray-100 rounded-xl space-y-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1">
                                  <Mail size={11} className="text-blue-500" /> Discovered Email Addresses ({rec.alternateEmails?.length || 1})
                                </span>
                                <div className="space-y-1.5">
                                  {rec.alternateEmails && rec.alternateEmails.length > 0 ? (
                                    rec.alternateEmails.map((e, eIdx) => (
                                      <div key={eIdx} className="flex items-center justify-between gap-2 text-[11px] bg-white p-2 rounded-lg border border-gray-100">
                                        <span className="font-semibold text-gray-800 font-mono">{e.email}</span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{e.source}</span>
                                          {e.is_primary ? (
                                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded font-bold">Primary</span>
                                          ) : (
                                            <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded font-bold">Alternate</span>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-[11px] font-semibold text-gray-700">{rec.primaryEmail || 'No email recorded'}</div>
                                  )}
                                </div>
                              </div>

                              {/* All Phones & Addresses */}
                              <div className="p-3 bg-gray-50/60 border border-gray-100 rounded-xl space-y-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-1">
                                  <Phone size={11} className="text-purple-500" /> Discovered Phone Numbers ({rec.alternatePhones?.length || 1})
                                </span>
                                <div className="space-y-1.5">
                                  {rec.alternatePhones && rec.alternatePhones.length > 0 ? (
                                    rec.alternatePhones.map((p, pIdx) => (
                                      <div key={pIdx} className="flex items-center justify-between gap-2 text-[11px] bg-white p-2 rounded-lg border border-gray-100">
                                        <span className="font-semibold text-gray-800 font-mono">{p.phone}</span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{p.source}</span>
                                          {p.is_primary ? (
                                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded font-bold">Primary</span>
                                          ) : (
                                            <span className="text-[9px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded font-bold">Alternate</span>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-[11px] font-semibold text-gray-700">{rec.primaryPhone || 'No phone recorded'}</div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Section 3: Raw Contributing Records Table */}
                            {srcRecordsForRec.length > 0 && (
                              <div className="space-y-2 pt-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                  Raw Contributing Source Records ({srcRecordsForRec.length})
                                </span>
                                <div className="border border-gray-100 rounded-xl overflow-x-auto max-h-48 overflow-y-auto">
                                  <table className="w-full text-left border-collapse text-[11px]">
                                    <thead>
                                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase text-[9px] tracking-wider sticky top-0">
                                        <th className="px-3 py-2">Source System</th>
                                        <th className="px-3 py-2">Source Record ID</th>
                                        <th className="px-3 py-2">Name in Source</th>
                                        <th className="px-3 py-2">Email in Source</th>
                                        <th className="px-3 py-2">Phone in Source</th>
                                        <th className="px-3 py-2">Address</th>
                                        <th className="px-3 py-2">Trust Score</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                      {srcRecordsForRec.map((sr, srIdx) => (
                                        <tr key={srIdx} className="hover:bg-gray-50/80">
                                          <td className="px-3 py-1.5 font-bold text-indigo-700">{sr.systemName}</td>
                                          <td className="px-3 py-1.5 font-mono text-gray-600">#{sr.systemRecordId}</td>
                                          <td className="px-3 py-1.5 font-medium text-gray-900">{sr.originalName || sr.attributes?.name || sr.attributes?.cust_name || rec.masterName}</td>
                                          <td className="px-3 py-1.5 text-gray-600 font-mono">{sr.emailOriginal || sr.attributes?.email || '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-600 font-mono">{sr.phoneOriginal || sr.attributes?.phone || '—'}</td>
                                          <td className="px-3 py-1.5 text-gray-500 truncate max-w-[150px]">{String(sr.attributes?.address || sr.attributes?.addr || rec.address || '—')}</td>
                                          <td className="px-3 py-1.5">
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                              {sr.trustScore || 98}%
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

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
        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex items-center justify-between text-[12px] text-gray-500">
          <span>Showing {records.length} of {total.toLocaleString()} golden records</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-40 transition">
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 font-semibold">
              {page} / {totalPages || 1}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-40 transition">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

