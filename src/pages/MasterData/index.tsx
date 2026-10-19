import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight,
  Eye, Plus, RefreshCw, Download, Users, Package, Truck, MapPin
} from 'lucide-react';
import { mockMasterDataService } from '../../services/masterDataService';
import { MasterRecord } from '../../types';
import ExcelView, { ExcelViewToggle, ExcelColumn } from '../../components/ExcelView';

const domainConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  customer: { icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Customers' },
  product: { icon: Package, color: 'text-violet-600', bg: 'bg-violet-50', label: 'Products' },
  supplier: { icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Suppliers' },
  location: { icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Locations' },
};

export default function MasterData() {
  const { domain } = useParams<{ domain: string }>();
  const navigate = useNavigate();
  const activeDomain = (domain as 'customer' | 'product' | 'supplier' | 'location') || 'customer';

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [excelView, setExcelView] = useState(false);

  const cfg = domainConfig[activeDomain] || domainConfig.customer;
  const DomainIcon = cfg.icon;

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await mockMasterDataService.getRecords(activeDomain, {
        search, status: statusFilter || undefined,
        matchStatus: matchFilter || undefined,
        page: excelView ? 1 : page,
        pageSize: excelView ? 10000 : pageSize,
        sortBy, sortOrder
      });
      setRecords(res.records);
      setTotal(res.total);
      setSelectedIds([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { setPage(1); setSearch(''); setStatusFilter(''); setMatchFilter(''); }, [activeDomain]);
  useEffect(() => { loadRecords(); }, [activeDomain, page, sortBy, sortOrder, statusFilter, matchFilter, excelView]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
  };

  const StatusBadge = ({ status }: { status: MasterRecord['status'] }) => {
    const s = { active: 'bg-emerald-50 text-emerald-700 border-emerald-200', inactive: 'bg-gray-100 text-gray-500 border-gray-200', pending: 'bg-amber-50 text-amber-700 border-amber-200' };
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${s[status]}`}>{status}</span>;
  };

  const MatchBadge = ({ matchStatus }: { matchStatus: MasterRecord['matchStatus'] }) => {
    const s = {
      matched: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      unmatched: 'bg-gray-100 text-gray-500 border-gray-200',
      potential_duplicate: 'bg-red-50 text-red-700 border-red-200'
    };
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s[matchStatus]}`}>{matchStatus.replace(/_/g, ' ')}</span>;
  };

  const SortTh = ({ field, label }: { field: string; label: string }) => (
    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800 transition select-none whitespace-nowrap"
      onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">{label} <ArrowUpDown size={11} className="text-gray-300" /></div>
    </th>
  );

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${cfg.bg}`}>
            <DomainIcon size={18} className={cfg.color} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{cfg.label} Catalog</h2>
            <p className="text-[12px] text-gray-400">{total.toLocaleString()} total records across all sources</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <ExcelViewToggle active={excelView} onToggle={() => setExcelView(v => !v)} />
          <button className="flex items-center gap-1.5 text-[12px] bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 py-1.5 px-3.5 rounded-lg font-medium transition">
            <Download size={13} /> Export
          </button>
          <button className="flex items-center gap-1.5 text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3.5 rounded-lg font-semibold transition shadow-sm shadow-indigo-200">
            <Plus size={13} /> New Record
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 card-shadow">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={`Search ${cfg.label.toLowerCase()}...`}
            className="w-full text-[13px] bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-lg py-1.5 pl-8 pr-4 text-gray-700 placeholder-gray-400 outline-none transition"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-[12px] bg-gray-50 border border-gray-200 text-gray-600 py-1.5 px-2.5 rounded-lg outline-none cursor-pointer focus:border-indigo-300">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>

          {activeDomain === 'customer' && (
            <select value={matchFilter} onChange={e => { setMatchFilter(e.target.value); setPage(1); }}
              className="text-[12px] bg-gray-50 border border-gray-200 text-gray-600 py-1.5 px-2.5 rounded-lg outline-none cursor-pointer focus:border-indigo-300">
              <option value="">All Match States</option>
              <option value="matched">Matched</option>
              <option value="unmatched">Unmatched</option>
              <option value="potential_duplicate">Potential Duplicate</option>
            </select>
          )}

          {(search || statusFilter || matchFilter) && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setMatchFilter(''); setPage(1); }}
              className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition font-medium">
              <RefreshCw size={11} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ── EXCEL VIEW ── */}
      {excelView && (
        <div className="flex-1 flex flex-col">
          <div className="bg-[#1d6f42] text-[#c6efce] text-[11px] font-semibold px-4 py-2 rounded-t-2xl flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#c6efce" /><text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1d6f42" fontFamily="Arial">X</text></svg>
            Microsoft Excel — {cfg.label} Catalog ({records.length} records)
          </div>
          <ExcelView<MasterRecord>
            columns={[
              { label: 'ID', key: 'id', sortable: true, minWidth: 100, render: r => <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4338ca' }}>{r.id}</span> },
              { label: 'Name', key: 'name', sortable: true, minWidth: 160, render: r => <span style={{ fontWeight: 600 }}>{r.name}</span> },
              ...(activeDomain === 'customer' ? [
                { label: 'Email', key: 'email', minWidth: 180, render: (r: MasterRecord) => <span style={{ color: '#374151', fontFamily: 'monospace' }}>{r.email && r.email.includes('@') ? r.email : '—'}</span> } as ExcelColumn<MasterRecord>,
                { label: 'Phone', key: 'phone', minWidth: 120, render: (r: MasterRecord) => <span style={{ color: '#374151' }}>{r.phone || '—'}</span> } as ExcelColumn<MasterRecord>,
                { label: 'City', key: 'city', minWidth: 100, render: (r: MasterRecord) => <span>{r.city || '—'}</span> } as ExcelColumn<MasterRecord>,
                { label: 'State', key: 'state', minWidth: 80, render: (r: MasterRecord) => <span>{r.state || '—'}</span> } as ExcelColumn<MasterRecord>,
              ] : []),
              ...(activeDomain === 'product' ? [
                { label: 'SKU', minWidth: 100, render: (r: MasterRecord) => <span style={{ fontFamily: 'monospace' }}>{r.attributes?.sku || '—'}</span> } as ExcelColumn<MasterRecord>,
                { label: 'Price', minWidth: 80, align: 'right' as const, render: (r: MasterRecord) => <span>${r.attributes?.unitPrice || '0.00'}</span> } as ExcelColumn<MasterRecord>,
              ] : []),
              { label: 'Source System', key: 'sourceSystem', minWidth: 130, render: r => <span style={{ color: '#6b7280' }}>{r.sourceSystem}</span> },
              { label: 'Status', key: 'status', minWidth: 90, render: r => <span style={{ fontWeight: 600, color: r.status === 'active' ? '#065f46' : r.status === 'pending' ? '#92400e' : '#374151' }}>{r.status}</span> },
              ...(activeDomain === 'customer' ? [
                { label: 'Match Status', key: 'matchStatus', minWidth: 120, render: (r: MasterRecord) => <span style={{ fontWeight: 600, color: r.matchStatus === 'matched' ? '#065f46' : r.matchStatus === 'potential_duplicate' ? '#b91c1c' : '#374151' }}>{(r.matchStatus || '').replace(/_/g, ' ')}</span> } as ExcelColumn<MasterRecord>,
              ] : []),
              { label: 'Last Updated', key: 'lastUpdated', minWidth: 140, render: r => <span style={{ color: '#9ca3af', fontSize: 11 }}>{r.lastUpdated?.substring(0, 10) || '—'}</span> },
            ] as ExcelColumn<MasterRecord>[]}
            data={records}
            loading={loading}
            onRowClick={r => navigate(`/master-data/${activeDomain}/${r.id}`)}
            rowKey={r => r.id}
            sortKey={sortBy}
            sortDir={sortOrder}
            onSort={k => handleSort(k)}
            emptyMessage="No records found — adjust filters above"
            maxHeight="calc(100vh - 280px)"
          />
        </div>
      )}

      {/* ── NORMAL TABLE VIEW ── */}
      {!excelView && (
      <div className="bg-white border border-gray-100 rounded-2xl card-shadow flex-1 flex flex-col overflow-hidden min-h-[300px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox"
                    checked={records.length > 0 && selectedIds.length === records.length}
                    onChange={e => setSelectedIds(e.target.checked ? records.map(r => r.id) : [])}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer" />
                </th>
                <SortTh field="id" label="ID" />
                <SortTh field="name" label="Name" />
                {activeDomain === 'customer' && <>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left">Email</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left">Location</th>
                </> }
                {activeDomain === 'product' && <>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left">SKU</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left">Price</th>
                </> }
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left">Source</th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left">Status</th>
                {activeDomain === 'customer' && <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-left">Match</th>}
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3.5"><div className="h-3.5 w-3.5 skeleton rounded" /></td>
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3.5"><div className="h-3.5 skeleton rounded" style={{ width: `${60 + j * 15}px` }} /></td>)}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <Search size={18} className="text-gray-300" />
                    </div>
                    <p className="text-[13px] font-semibold text-gray-400">No records found</p>
                    <p className="text-[12px] text-gray-300">Try adjusting your search or filters</p>
                  </div>
                </td></tr>
              ) : records.map(record => {
                const sel = selectedIds.includes(record.id);
                return (
                  <tr key={record.id}
                    onClick={() => navigate(`/master-data/${activeDomain}/${record.id}`)}
                    className={`hover:bg-indigo-50/30 transition cursor-pointer ${sel ? 'bg-indigo-50/20' : ''}`}>
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={sel}
                        onChange={() => setSelectedIds(prev => prev.includes(record.id) ? prev.filter(x => x !== record.id) : [...prev, record.id])}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3.5 text-[12px] font-semibold text-indigo-600">{record.id}</td>
                    <td className="px-4 py-3.5 text-[13px] font-semibold text-gray-900">{record.name}</td>
                    {activeDomain === 'customer' && <>
                      <td className="px-4 py-3.5 text-[12px] text-gray-500">{record.email}</td>
                      <td className="px-4 py-3.5 text-[12px] text-gray-500">{record.city}, {record.state}</td>
                    </> }
                    {activeDomain === 'product' && <>
                      <td className="px-4 py-3.5 text-[12px] font-mono text-gray-500">{record.attributes.sku || '—'}</td>
                      <td className="px-4 py-3.5 text-[12px] text-gray-600 font-medium">${record.attributes.unitPrice || '0.00'}</td>
                    </> }
                    <td className="px-4 py-3.5 text-[12px] text-gray-400">{record.sourceSystem}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={record.status} /></td>
                    {activeDomain === 'customer' && <td className="px-4 py-3.5"><MatchBadge matchStatus={record.matchStatus} /></td>}
                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => navigate(`/master-data/${activeDomain}/${record.id}`)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition ml-auto">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-[12px] text-gray-500 bg-gray-50/50 rounded-b-2xl">
          <span>{selectedIds.length > 0 ? <span className="text-indigo-600 font-semibold">{selectedIds.length} selected</span> : `${(page-1)*pageSize+1}–${Math.min(page*pageSize, total)} of ${total} records`}</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-40 transition">
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 font-semibold">{page}</span>
            <button disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white border border-transparent hover:border-gray-200 disabled:opacity-40 transition">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

