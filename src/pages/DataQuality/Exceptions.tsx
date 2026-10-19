import React, { useEffect, useState } from 'react';
import { AlertOctagon, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { mockQualityService } from '../../services/qualityService';
import { QualityException } from '../../types';

export default function Exceptions() {
  const [loading, setLoading] = useState(true);
  const [exceptions, setExceptions] = useState<QualityException[]>([]);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const data = await mockQualityService.getExceptions();
    const filtered = filter ? data.filter(e => e.status === filter) : data;
    setExceptions(filtered);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleResolve = async (id: string) => {
    await mockQualityService.resolveException(id, 'Corrected via data stewardship review.');
    load();
  };

  const SeverityIcon = ({ s }: { s: string }) => {
    if (s === 'critical') return <AlertOctagon size={14} className="text-red-500" />;
    if (s === 'high') return <AlertTriangle size={14} className="text-orange-500" />;
    return <AlertTriangle size={14} className="text-amber-400" />;
  };

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
          <AlertOctagon size={18} className="text-orange-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Quality Exceptions</h2>
          <p className="text-[12px] text-gray-400">Records failing validation rules that require stewardship action.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap card-shadow">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-400">Status:</span>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="text-[12px] bg-gray-50 border border-gray-200 text-gray-600 py-1.5 px-2.5 rounded-lg outline-none cursor-pointer">
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <button onClick={load} className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1 ml-auto transition">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* Exception Cards */}
      <div className="space-y-3 flex-1">
        {loading ? [...Array(3)].map((_, i) => <div key={i} className="h-32 skeleton rounded-2xl" />) :
          exceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <CheckCircle size={24} className="text-emerald-500" />
              </div>
              <p className="text-[13px] font-semibold text-gray-500">No exceptions</p>
              <p className="text-[12px] text-gray-300">All records pass current quality rules.</p>
            </div>
          ) : exceptions.map(ex => (
            <div key={ex.id} className={`bg-white border rounded-2xl p-5 card-shadow ${ex.status === 'open' ? 'border-gray-100' : 'border-emerald-100 opacity-70'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${ex.severity === 'critical' ? 'bg-red-50' : 'bg-orange-50'}`}>
                    <SeverityIcon s={ex.severity} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[12px] font-bold text-indigo-600">{ex.recordId}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border ${ex.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{ex.severity}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize border ${ex.status === 'open' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{ex.status}</span>
                    </div>
                    <p className="text-[13px] font-semibold text-gray-900">{ex.ruleName}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Current Value: <code className="bg-red-50 text-red-600 px-1 py-0.5 rounded text-[11px] border border-red-100">{ex.currentValue}</code>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Expected Schema: <span className="text-gray-700 font-semibold">{ex.expectedValue}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {ex.status === 'open' ? (
                    <button onClick={() => handleResolve(ex.id)}
                      className="text-[12px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-4 rounded-xl transition flex items-center gap-1.5">
                      <CheckCircle size={12} /> Resolve
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[12px] text-emerald-600 font-semibold">
                      <CheckCircle size={14} className="text-emerald-500" /> Resolved
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
