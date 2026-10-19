import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitMerge, Eye, RefreshCw, CheckCircle, AlertTriangle,
  CheckCheck, X, HelpCircle, Tag, ChevronDown, ChevronUp
} from 'lucide-react';
import { mockMatchingService } from '../../services/matchingService';
import { mockMasterDataService, appendAuditEntry } from '../../services/masterDataService';
import { PotentialDuplicate, MatchEvidence } from '../../types';
import ExcelView, { ExcelViewToggle, ExcelColumn } from '../../components/ExcelView';
import { formatSimilarityScore } from '../../utils/formatters';

// ─── Field status helpers ───────────────────────────────────────────────────
const FieldStatusIcon = ({ status }: { status: string }) => {
  if (status === 'EXACT_MATCH') return <CheckCheck size={11} className="text-emerald-500" />;
  if (status === 'PARTIAL_MATCH') return <CheckCircle size={11} className="text-amber-400" />;
  if (status === 'MISMATCH') return <X size={11} className="text-red-400" />;
  return <HelpCircle size={11} className="text-gray-300" />;
};

const matchScoreColor = (score: number) => {
  if (score >= 0.85) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (score >= 0.65) return 'text-amber-700 bg-amber-50 border-amber-100';
  return 'text-orange-700 bg-orange-50 border-orange-100';
};

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function DuplicateReview() {
  const navigate = useNavigate();
  const [loading, setLoading]           = useState(true);
  const [duplicates, setDuplicates]     = useState<PotentialDuplicate[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [excelView, setExcelView]       = useState(false);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [evidenceMap, setEvidenceMap]   = useState<Record<string, MatchEvidence | null>>({});
  const [actionState, setActionState]   = useState<Record<string, string>>({});  // pairId → action taken

  const load = async () => {
    setLoading(true);
    try {
      const res = await mockMatchingService.getPotentialDuplicates();
      let filtered = res;
      if (statusFilter) {
        filtered = filtered.filter(d => d.status === statusFilter);
      }
      setDuplicates(filtered);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const loadEvidence = async (pairId: string) => {
    if (evidenceMap[pairId] !== undefined) return;
    const ev = await mockMasterDataService.getMatchEvidence(pairId);
    setEvidenceMap(prev => ({ ...prev, [pairId]: ev }));
  };

  const handleExpand = (dup: PotentialDuplicate) => {
    const newId = expandedId === dup.id ? null : dup.id;
    setExpandedId(newId);
    if (newId) loadEvidence(dup.id);
  };

  const handleAction = (dup: PotentialDuplicate, action: 'MERGE' | 'REJECT') => {
    appendAuditEntry({
      clusterId: dup.recordA.goldenRecordId || dup.id,
      mdmCustomerId: dup.recordAMdmId || undefined,
      pairId: dup.id,
      action,
      steward: 'Steward',
      reason: action === 'MERGE' ? 'Manually merged by steward' : 'Confirmed as distinct records',
    });
    setActionState(prev => ({ ...prev, [dup.id]: action }));
    mockMatchingService.updateDuplicateStatus(dup.id, action === 'MERGE' ? 'merged' : 'rejected');
    setTimeout(() => load(), 400);
  };

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
          <GitMerge size={18} className="text-violet-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Duplicate Candidate Review</h2>
          <p className="text-[12px] text-gray-400">
            Review ML-detected match pairs with field-level evidence and resolve or reject.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-400">Status:</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-[12px] bg-gray-50 border border-gray-200 text-gray-600 py-1.5 px-2.5 rounded-lg outline-none cursor-pointer">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="merged">Merged</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <span className="text-[11px] text-gray-400 ml-auto">{duplicates.length} pair{duplicates.length !== 1 ? 's' : ''}</span>
        <button onClick={load} className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition">
          <RefreshCw size={11} /> Refresh
        </button>
        <ExcelViewToggle excelView={excelView} onToggle={() => setExcelView(!excelView)} />
      </div>

      {/* Excel View */}
      {excelView && (
        <div className="flex-1 flex flex-col">
          <div className="bg-[#1d6f42] text-[#c6efce] text-[11px] font-semibold px-4 py-2 rounded-t-2xl flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#c6efce" /><text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1d6f42" fontFamily="Arial">X</text></svg>
            Microsoft Excel — Duplicate Candidates ({duplicates.length} records)
          </div>
          <ExcelView<PotentialDuplicate>
            columns={[
              { label: 'Pair ID', key: 'id', sortable: true, minWidth: 100, render: d => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed' }}>{d.id}</span> },
              { label: 'Record A', minWidth: 160, render: d => <span style={{ fontWeight: 600 }}>{d.recordA.name}</span> },
              { label: 'Record A Email', minWidth: 170, render: d => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.recordA.email && d.recordA.email.includes('@') ? d.recordA.email : '—'}</span> },
              { label: 'Record A Source', minWidth: 120, render: d => <span style={{ color: '#6b7280' }}>{d.recordA.sourceSystem}</span> },
              { label: 'Record B', minWidth: 160, render: d => <span style={{ fontWeight: 600 }}>{d.recordB.name}</span> },
              { label: 'Record B Email', minWidth: 170, render: d => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.recordB.email && d.recordB.email.includes('@') ? d.recordB.email : '—'}</span> },
              { label: 'Record B Source', minWidth: 120, render: d => <span style={{ color: '#6b7280' }}>{d.recordB.sourceSystem}</span> },
              { label: 'Match Score', key: 'matchScore', sortable: true, minWidth: 110, render: d => {
                const score = d.matchScore;
                const normalized = score > 0 && score <= 1.0 ? score * 100 : score;
                const color = normalized >= 85 ? '#059669' : normalized >= 65 ? '#d97706' : '#c2410c';
                return <span style={{ fontWeight: 700, color }}>{formatSimilarityScore(score)}</span>;
              } },
              { label: 'Status', key: 'status', minWidth: 90, render: d => <span style={{ fontWeight: 600, color: d.status === 'merged' ? '#059669' : d.status === 'rejected' ? '#dc2626' : '#d97706' }}>{d.status}</span> },
              { label: 'Actions', minWidth: 160, align: 'center' as const, render: d => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={(e) => { e.stopPropagation(); handleAction(d, 'MERGE'); }} style={{ background: '#059669', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Merge</button>
                  <button onClick={(e) => { e.stopPropagation(); handleAction(d, 'REJECT'); }} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                </div>
              )}
            ] as ExcelColumn<PotentialDuplicate>[]}
            data={duplicates}
            loading={loading}
            rowKey={d => d.id}
            emptyMessage="No duplicates found"
            maxHeight="calc(100vh - 280px)"
          />
        </div>
      )}

      {/* Duplicate Card List */}
      {!excelView && (
      <div className="space-y-3 flex-1">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-28 skeleton rounded-2xl" />)
        ) : duplicates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <p className="text-[13px] font-semibold text-gray-500">No duplicates to review</p>
            <p className="text-[12px] text-gray-300">All match candidates have been resolved.</p>
          </div>
        ) : duplicates.map(dup => {
          const isExpanded = expandedId === dup.id;
          const evidence = evidenceMap[dup.id];
          const taken = actionState[dup.id];

          return (
            <div key={dup.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm transition-all">
              {/* Card Header */}
              <div className="p-5 flex items-start gap-4">
                <div className="h-9 w-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                  <GitMerge size={16} className="text-violet-500" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* IDs + status */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {dup.recordAMdmId && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                        <Tag size={8} />{dup.recordAMdmId}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-indigo-600">{dup.recordA.id}</span>
                    <span className="text-[11px] text-gray-300">↔</span>
                    {dup.recordBMdmId && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                        <Tag size={8} />{dup.recordBMdmId}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-indigo-600">{dup.recordB.id}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ml-auto border ${
                      dup.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>{dup.status}</span>
                  </div>

                  {/* Side-by-side summary */}
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {[{ rec: dup.recordA, label: 'Record A' }, { rec: dup.recordB, label: 'Record B' }].map(({ rec, label }) => (
                      <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">{rec.sourceSystem}</p>
                        <div className="space-y-1 text-[11px]">
                          {[['Name', rec.name], ['Email', rec.email], ['City', rec.city]].map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-2">
                              <span className="text-gray-400">{k}</span>
                              <span className="font-semibold text-gray-700 truncate max-w-[130px]">{v || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Match attribute chips */}
                  {(dup.matchingAttributes.length > 0 || dup.conflictingAttributes.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dup.matchingAttributes.slice(0, 4).map(a => (
                        <span key={a} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <CheckCheck size={8} />{a}
                        </span>
                      ))}
                      {dup.conflictingAttributes.slice(0, 3).map(a => (
                        <span key={a} className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <X size={8} />{a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score + Actions */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className={`text-center px-3 py-2 rounded-xl border ${matchScoreColor(dup.matchScore)}`}>
                    <p className="text-xl font-bold">{Math.round(dup.matchScore * 100)}%</p>
                    <p className="text-[9px] font-semibold uppercase">Match Score</p>
                  </div>

                  {dup.status === 'pending' && !taken ? (
                    <div className="flex flex-col gap-1.5 w-full">
                      <button onClick={(e) => { e.stopPropagation(); handleAction(dup, 'MERGE'); }}
                        className="text-[11px] bg-violet-600 hover:bg-violet-700 text-white font-semibold py-1.5 px-3 rounded-lg transition w-full">
                        Merge
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleAction(dup, 'REJECT'); }}
                        className="text-[11px] bg-white border border-gray-200 hover:border-red-300 hover:text-red-600 text-gray-500 font-semibold py-1.5 px-3 rounded-lg transition w-full">
                        Not Duplicate
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/stewardship/merge/${dup.id}`); }}
                        className="text-[11px] text-violet-600 hover:underline font-semibold flex items-center justify-center gap-1 w-full">
                        <Eye size={11} /> Detail
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-600">{taken || dup.status}</span>
                  )}
                </div>
              </div>

              {/* Evidence toggle */}
              {dup.hasEvidence && (
                <div className="border-t border-gray-50">
                  <button
                    onClick={() => handleExpand(dup)}
                    className="w-full flex items-center justify-between px-5 py-2.5 text-[11px] text-gray-400 hover:text-violet-600 hover:bg-violet-50/40 transition rounded-b-2xl"
                  >
                    <span className="font-semibold">Field-Level Match Evidence</span>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4">
                      {evidence === undefined ? (
                        <div className="text-[12px] text-gray-300 text-center py-4">Loading evidence...</div>
                      ) : evidence === null ? (
                        <div className="text-[12px] text-gray-300 text-center py-4">No field evidence available for this pair.</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-gray-100">
                                {['Field', 'Record A', 'Record B', 'Status'].map(h => (
                                  <th key={h} className="py-2 px-3 text-[10px] font-bold text-gray-400 uppercase">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {evidence.fieldEvidence.map((fe, i) => (
                                <tr key={i} className={
                                  fe.status === 'EXACT_MATCH' ? 'bg-emerald-50/40' :
                                  fe.status === 'MISMATCH'    ? 'bg-red-50/40' : ''
                                }>
                                  <td className="py-2 px-3 text-[11px] font-semibold text-gray-600">{fe.field}</td>
                                  <td className="py-2 px-3 text-[11px] text-gray-700 max-w-[120px] truncate">{fe.valueA || <span className="text-gray-300 italic">null</span>}</td>
                                  <td className="py-2 px-3 text-[11px] text-gray-700 max-w-[120px] truncate">{fe.valueB || <span className="text-gray-300 italic">null</span>}</td>
                                  <td className="py-2 px-3">
                                    <span className="flex items-center gap-1">
                                      <FieldStatusIcon status={fe.status} />
                                      <span className="text-[10px] text-gray-400">{fe.status.replace(/_/g, ' ')}</span>
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
                            <span className="flex items-center gap-1"><CheckCheck size={11} className="text-emerald-500" /> {evidence.matchingCount} matching</span>
                            <span className="flex items-center gap-1"><X size={11} className="text-red-400" /> {evidence.conflictingCount} conflicting</span>
                            <span className="flex items-center gap-1"><HelpCircle size={11} className="text-gray-300" /> {evidence.unknownCount} unknown</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

