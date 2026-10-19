import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitMerge,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Tag,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  LayoutGrid,
  Table2,
  Search,
  Filter,
  Eye,
} from 'lucide-react';
import { mockMatchingService } from '../../services/matchingService';
import { PotentialDuplicate } from '../../types';
import { formatSimilarityScore } from '../../utils/formatters';
import ExcelView, { ExcelColumn } from '../../components/ExcelView';

// ─── Similarity Score Badge ──────────────────────────────────────────────────
const ScoreBadge = ({ score }: { score: number }) => {
  const normalized = score > 0 && score <= 1.0 ? score * 100 : score;
  const color =
    normalized >= 90
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : normalized >= 75
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center font-extrabold text-[12px] px-2.5 py-0.5 rounded-lg border ${color}`}>
      {formatSimilarityScore(score)}
    </span>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    merged: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rejected: 'bg-red-50 text-red-600 border-red-100',
    not_a_duplicate: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${cfg[status] || cfg.pending}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

export default function DuplicateReview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card' | 'excel'>('table');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const loadDuplicates = async () => {
    setLoading(true);
    try {
      const data = await mockMatchingService.getPotentialDuplicates();
      setDuplicates(data);
    } catch (err) {
      console.error('Error loading duplicates', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDuplicates();
  }, []);

  const handleAction = async (id: string, action: 'accept' | 'reject' | 'not_a_duplicate') => {
    try {
      if (action === 'accept') {
        setMessage(`Duplicate pair ${id} accepted into golden cluster.`);
      } else if (action === 'reject') {
        await mockMatchingService.rejectDuplicate(id);
        setMessage('Duplicate pair rejected from queue.');
      } else {
        await mockMatchingService.markNotDuplicate(id);
        setMessage('Records marked as non-duplicates.');
      }
      setTimeout(() => setMessage(null), 3000);
      loadDuplicates();
    } catch (err) {
      console.error('Error processing duplicate action', err);
    }
  };

  const filtered = duplicates.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.recordA.name.toLowerCase().includes(q) ||
      d.recordB.name.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q) ||
      (d.recordA.email || '').toLowerCase().includes(q) ||
      (d.recordB.email || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        <div className="h-10 skeleton rounded-2xl w-1/3"></div>
        <div className="h-12 skeleton rounded-xl"></div>
        <div className="h-64 skeleton rounded-2xl"></div>
        <div className="h-64 skeleton rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full bg-gray-50 text-gray-900">

      {/* ── Header ── */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <GitMerge size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Duplicate Review Queue</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {filtered.length} candidate pair{filtered.length !== 1 ? 's' : ''} pending steward review
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Table2 size={13} /> Table
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition ${
                viewMode === 'card' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid size={13} /> Cards
            </button>
            <button
              onClick={() => setViewMode('excel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition ${
                viewMode === 'excel' ? 'bg-[#1d6f42] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="currentColor" /><text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1d6f42" fontFamily="Arial">X</text></svg> Excel View
            </button>
          </div>

          <button
            onClick={loadDuplicates}
            className="text-xs text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 hover:border-indigo-200 py-1.5 px-3.5 rounded-xl font-medium transition flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Toast ── */}
      {message && (
        <div className="bg-indigo-50/80 border border-indigo-100 text-indigo-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs animate-in fade-in duration-200">
          <Sparkles size={14} className="text-indigo-500" />
          {message}
        </div>
      )}

      {/* ── Search bar ── */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or pair ID..."
            className="w-full text-[13px] bg-gray-50 border border-gray-200 focus:border-indigo-300 rounded-lg py-1.5 pl-8 pr-4 text-gray-700 placeholder-gray-400 outline-none transition"
          />
        </div>
        <span className="text-[11px] text-gray-400 font-medium">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Excel View ── */}
      {viewMode === 'excel' && (
        <div className="flex-1 flex flex-col">
          <div className="bg-[#1d6f42] text-[#c6efce] text-[11px] font-semibold px-4 py-2 rounded-t-2xl flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#c6efce" /><text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1d6f42" fontFamily="Arial">X</text></svg>
            Microsoft Excel — Duplicate Review Queue ({filtered.length} candidate pairs)
          </div>
          <ExcelView<PotentialDuplicate>
            columns={[
              { label: 'Pair ID', key: 'id', sortable: true, minWidth: 100, render: d => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>{d.id}</span> },
              { label: 'Record A Name', minWidth: 150, render: d => <span style={{ fontWeight: 600 }}>{d.recordA.name}</span> },
              { label: 'Record A Email', minWidth: 170, render: d => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.recordA.email && d.recordA.email.includes('@') ? d.recordA.email : '—'}</span> },
              { label: 'Record A Source', minWidth: 120, render: d => <span style={{ color: '#6b7280' }}>{d.recordA.sourceSystem}</span> },
              { label: 'Record B Name', minWidth: 150, render: d => <span style={{ fontWeight: 600 }}>{d.recordB.name}</span> },
              { label: 'Record B Email', minWidth: 170, render: d => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.recordB.email && d.recordB.email.includes('@') ? d.recordB.email : '—'}</span> },
              { label: 'Record B Source', minWidth: 120, render: d => <span style={{ color: '#6b7280' }}>{d.recordB.sourceSystem}</span> },
              { label: 'Similarity', key: 'matchScore', sortable: true, minWidth: 100, render: d => {
                const score = d.matchScore;
                const normalized = score > 0 && score <= 1.0 ? score * 100 : score;
                const color = normalized >= 90 ? '#059669' : normalized >= 75 ? '#d97706' : '#dc2626';
                return <span style={{ fontWeight: 700, color }}>{formatSimilarityScore(score)}</span>;
              } },
              { label: 'Status', key: 'status', minWidth: 90, render: d => <span style={{ fontWeight: 600, color: d.status === 'merged' ? '#059669' : d.status === 'rejected' ? '#dc2626' : '#d97706' }}>{d.status}</span> },
              { label: 'Actions', minWidth: 160, align: 'center' as const, render: d => (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={(e) => { e.stopPropagation(); handleAction(d.id, 'accept'); }} style={{ background: '#059669', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Merge</button>
                  <button onClick={(e) => { e.stopPropagation(); handleAction(d.id, 'reject'); }} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                </div>
              )}
            ] as ExcelColumn<PotentialDuplicate>[]}
            data={filtered}
            loading={loading}
            rowKey={d => d.id}
            emptyMessage="No pending duplicate reviews"
            maxHeight="calc(100vh - 280px)"
          />
        </div>
      )}

      {viewMode !== 'excel' && (
      <>


      {/* ── Empty State ── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-20 px-6 text-center shadow-sm max-w-md mx-auto my-auto flex flex-col items-center gap-3">
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl flex items-center justify-center">
            <CheckCircle size={22} />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-gray-800">
              {search ? 'No matches found' : 'All duplicates resolved'}
            </h4>
            <p className="text-xs text-gray-400 max-w-xs">
              {search ? 'Try a different search term.' : 'There are no pending duplicate records requiring manual review.'}
            </p>
          </div>
        </div>
      ) : viewMode === 'table' ? (

        /* ════════════════════════════════════════════════════════
           TABLE VIEW
           ════════════════════════════════════════════════════════ */
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {[
                    'Pair ID',
                    'Record A',
                    'Record B',
                    'Matching Fields',
                    'Conflicts',
                    'Similarity',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((dup) => {
                  const isExpanded = expandedRow === dup.id;
                  return (
                    <React.Fragment key={dup.id}>
                      <tr
                        className={`transition cursor-pointer group ${
                          isExpanded
                            ? 'bg-indigo-50/50 border-l-4 border-indigo-500'
                            : 'hover:bg-indigo-50/20'
                        }`}
                        onClick={() => setExpandedRow(isExpanded ? null : dup.id)}
                      >
                        {/* Pair ID */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              className="h-5 w-5 rounded flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 transition"
                              title={isExpanded ? 'Collapse' : 'Expand details'}
                            >
                              {isExpanded ? <ChevronUp size={13} className="text-indigo-600" /> : <ChevronDown size={13} />}
                            </button>
                            <span className="text-[11px] font-bold text-indigo-600 font-mono">{dup.id}</span>
                          </div>
                        </td>

                        {/* Record A */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[12px] font-bold text-gray-900">{dup.recordA.name}</span>
                            <span className="text-[10px] text-indigo-500 font-medium">{dup.recordA.sourceSystem}</span>
                            {dup.recordA.email && dup.recordA.email.includes('@') && (
                              <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <Mail size={9} className="text-blue-400" />{dup.recordA.email}
                              </span>
                            )}
                            {dup.recordA.phone && (
                              <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <Phone size={9} className="text-purple-400" />{dup.recordA.phone}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Record B */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[12px] font-bold text-gray-900">{dup.recordB.name}</span>
                            <span className="text-[10px] text-indigo-500 font-medium">{dup.recordB.sourceSystem}</span>
                            {dup.recordB.email && dup.recordB.email.includes('@') && (
                              <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <Mail size={9} className="text-blue-400" />{dup.recordB.email}
                              </span>
                            )}
                            {dup.recordB.phone && (
                              <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                <Phone size={9} className="text-purple-400" />{dup.recordB.phone}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Matching Fields */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {dup.matchingAttributes.slice(0, 3).map((attr) => (
                              <span
                                key={attr}
                                className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                              >
                                <Check size={8} />
                                {attr}
                              </span>
                            ))}
                            {dup.matchingAttributes.length > 3 && (
                              <span className="text-[9px] font-semibold text-gray-400">
                                +{dup.matchingAttributes.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Conflicts */}
                        <td className="px-4 py-3.5">
                          {dup.conflictingAttributes.length === 0 ? (
                            <span className="text-[10px] text-gray-300 italic">None</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[140px]">
                              {dup.conflictingAttributes.slice(0, 2).map((attr) => (
                                <span
                                  key={attr}
                                  className="text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                >
                                  <AlertCircle size={8} />
                                  {attr}
                                </span>
                              ))}
                              {dup.conflictingAttributes.length > 2 && (
                                <span className="text-[9px] font-semibold text-gray-400">
                                  +{dup.conflictingAttributes.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Similarity */}
                        <td className="px-4 py-3.5">
                          <ScoreBadge score={dup.matchScore} />
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <StatusBadge status={dup.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleAction(dup.id, 'accept')}
                              title="Accept Match"
                              className="h-7 px-2.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-1"
                            >
                              <Check size={11} /> Accept
                            </button>
                            <button
                              onClick={() => handleAction(dup.id, 'reject')}
                              title="Reject Match"
                              className="h-7 px-2.5 text-[10px] font-bold border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1"
                            >
                              <XCircle size={11} /> Reject
                            </button>
                            <button
                              onClick={() => navigate(`/stewardship/merge/${dup.id}`, { state: { duplicate: dup } })}
                              title="Open Master Reconciliation"
                              className="h-7 px-2.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition flex items-center gap-1"
                            >
                              <GitMerge size={11} /> Merge
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded Detail Row ── */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/10">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm space-y-4">

                              {/* Side-by-Side Attribute Comparison */}
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <GitMerge size={11} className="text-indigo-500" />
                                Attribute Comparison — {dup.recordA.name} vs {dup.recordB.name}
                              </h4>

                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-[11px]">
                                  <thead>
                                    <tr className="border-b border-gray-100">
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider w-32">Attribute</th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                                        {dup.recordA.name} <span className="font-normal text-gray-400">({dup.recordA.sourceSystem})</span>
                                      </th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                                        {dup.recordB.name} <span className="font-normal text-gray-400">({dup.recordB.sourceSystem})</span>
                                      </th>
                                      <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Match</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {[
                                      { field: 'Name', a: dup.recordA.name, b: dup.recordB.name },
                                      { field: 'Email', a: dup.recordA.email || '—', b: dup.recordB.email || '—' },
                                      { field: 'Phone', a: dup.recordA.phone || '—', b: dup.recordB.phone || '—' },
                                      { field: 'City', a: dup.recordA.city || '—', b: dup.recordB.city || '—' },
                                      { field: 'State', a: dup.recordA.state || '—', b: dup.recordB.state || '—' },
                                      { field: 'Source', a: dup.recordA.sourceSystem, b: dup.recordB.sourceSystem },
                                    ].map(({ field, a, b }) => {
                                      const matches = dup.matchingAttributes.map(s => s.toLowerCase()).includes(field.toLowerCase());
                                      const conflicts = dup.conflictingAttributes.map(s => s.toLowerCase()).includes(field.toLowerCase());
                                      const rowBg = matches ? 'bg-emerald-50/30' : conflicts ? 'bg-amber-50/30' : '';
                                      return (
                                        <tr key={field} className={`${rowBg} hover:bg-gray-50/60 transition`}>
                                          <td className="px-3 py-2 font-bold text-gray-600">{field}</td>
                                          <td className="px-3 py-2 font-mono text-gray-800">{String(a)}</td>
                                          <td className="px-3 py-2 font-mono text-gray-800">{String(b)}</td>
                                          <td className="px-3 py-2">
                                            {matches ? (
                                              <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                                                <Check size={9} /> Match
                                              </span>
                                            ) : conflicts ? (
                                              <span className="text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1 w-fit">
                                                <AlertCircle size={9} /> Conflict
                                              </span>
                                            ) : (
                                              <span className="text-[9px] text-gray-300">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Quick action strip */}
                              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                                <button
                                  onClick={() => handleAction(dup.id, 'accept')}
                                  className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-4 rounded-xl transition flex items-center gap-1.5"
                                >
                                  <Check size={12} /> Accept Match
                                </button>
                                <button
                                  onClick={() => handleAction(dup.id, 'reject')}
                                  className="text-[11px] border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold py-1.5 px-4 rounded-xl transition flex items-center gap-1.5"
                                >
                                  <XCircle size={12} /> Reject
                                </button>
                                <button
                                  onClick={() => navigate(`/stewardship/merge/${dup.id}`, { state: { duplicate: dup } })}
                                  className="text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-4 rounded-xl transition flex items-center gap-1.5 ml-auto"
                                >
                                  <GitMerge size={12} /> Open Full Reconciliation →
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

          {/* Table footer */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex items-center justify-between text-[11px] text-gray-500">
            <span>Showing {filtered.length} of {duplicates.length} pairs</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 inline-block"></span> Matching field
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block"></span> Conflict field
              </span>
            </div>
          </div>
        </div>

      ) : (

        /* ════════════════════════════════════════════════════════
           CARD VIEW  (kept from before, improved)
           ════════════════════════════════════════════════════════ */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filtered.map((dup) => (
            <div
              key={dup.id}
              className="bg-white border border-gray-100 hover:border-indigo-200 p-5 rounded-2xl flex flex-col justify-between space-y-4 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 font-mono uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                      <Tag size={10} /> Pair: {dup.id}
                    </span>
                    <StatusBadge status={dup.status} />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 flex-wrap leading-snug">
                    <span>{dup.recordA.name}</span>
                    <span className="text-gray-400 text-xs font-normal">vs</span>
                    <span>{dup.recordB.name}</span>
                  </h3>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Similarity</span>
                  <ScoreBadge score={dup.matchScore} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                <div className="space-y-0.5">
                  <p className="font-bold text-gray-700">{dup.recordA.sourceSystem}</p>
                  <p className="text-gray-500 font-mono text-[10px]">{dup.recordA.id}</p>
                  {dup.recordA.email && dup.recordA.email.includes('@') && (
                    <p className="text-gray-600 truncate flex items-center gap-1">
                      <Mail size={9} className="text-blue-400 shrink-0" />{dup.recordA.email}
                    </p>
                  )}
                  {dup.recordA.phone && (
                    <p className="text-gray-500 flex items-center gap-1">
                      <Phone size={9} className="text-purple-400 shrink-0" />{dup.recordA.phone}
                    </p>
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-gray-700">{dup.recordB.sourceSystem}</p>
                  <p className="text-gray-500 font-mono text-[10px]">{dup.recordB.id}</p>
                  {dup.recordB.email && dup.recordB.email.includes('@') && (
                    <p className="text-gray-600 truncate flex items-center gap-1">
                      <Mail size={9} className="text-blue-400 shrink-0" />{dup.recordB.email}
                    </p>
                  )}
                  {dup.recordB.phone && (
                    <p className="text-gray-500 flex items-center gap-1">
                      <Phone size={9} className="text-purple-400 shrink-0" />{dup.recordB.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-gray-50/40 p-3 border border-gray-100 rounded-xl">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider flex items-center gap-1">
                    <CheckCircle2 size={11} className="text-emerald-500" />
                    Matching ({dup.matchingAttributes.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {dup.matchingAttributes.map((attr) => (
                      <span key={attr} className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 px-2 py-0.5 rounded flex items-center gap-0.5">
                        <Check size={9} />{attr}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase block tracking-wider flex items-center gap-1">
                    <AlertCircle size={11} className="text-amber-500" />
                    Conflicts ({dup.conflictingAttributes.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {dup.conflictingAttributes.length === 0 ? (
                      <span className="text-[11px] text-gray-400 italic">None</span>
                    ) : dup.conflictingAttributes.map((attr) => (
                      <span key={attr} className="text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70 px-2 py-0.5 rounded flex items-center gap-0.5">
                        <AlertCircle size={9} />{attr}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(dup.id, 'accept')}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-xl transition flex items-center gap-1"
                  >
                    <Check size={11} /> Accept Match
                  </button>
                  <button
                    onClick={() => handleAction(dup.id, 'reject')}
                    className="text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 font-semibold py-1.5 px-3 rounded-xl transition flex items-center gap-1"
                  >
                    <XCircle size={11} /> Reject
                  </button>
                </div>
                <button
                  onClick={() => navigate(`/stewardship/merge/${dup.id}`, { state: { duplicate: dup } })}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl transition flex items-center gap-1.5 shadow-xs shadow-indigo-200"
                >
                  <GitMerge size={13} />
                  <span>Master Reconciliation →</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}

