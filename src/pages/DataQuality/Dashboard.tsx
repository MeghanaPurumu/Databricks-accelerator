import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ShieldCheck, AlertOctagon, ArrowRight, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { mockQualityService } from '../../services/qualityService';
import { QualityMetric, DomainQuality } from '../../types';

export default function QualityDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [domainMetrics, setDomainMetrics] = useState<DomainQuality[]>([]);

  useEffect(() => {
    Promise.all([mockQualityService.getQualityMetrics(), mockQualityService.getDomainQualityMetrics()])
      .then(([m, d]) => { setMetrics(m); setDomainMetrics(d); })
      .finally(() => setLoading(false));
  }, []);

  const overallScore = metrics.length
    ? Number((metrics.reduce((s, m) => s + m.score, 0) / metrics.length).toFixed(1))
    : 0;

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp size={12} className="text-emerald-500" />;
    if (trend === 'down') return <TrendingDown size={12} className="text-red-400" />;
    return <Minus size={12} className="text-gray-300" />;
  };

  if (loading) return (
    <div className="flex-1 p-6 space-y-5">
      <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-36 skeleton rounded-2xl" />)}</div>
      <div className="h-64 skeleton rounded-2xl" />
    </div>
  );

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <Activity size={18} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Data Quality Governance</h2>
          <p className="text-[12px] text-gray-400">Track completeness, accuracy and validity across all master data domains.</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Score */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 card-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Overall Quality</p>
            <p className="text-3xl font-bold text-gray-900">{overallScore}%</p>
            <p className="text-[11px] text-emerald-500 font-semibold mt-1.5 flex items-center gap-1"><TrendingUp size={11} /> Compliant with schemas</p>
          </div>
          <div className="relative h-20 w-20">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#f0fdf4" strokeWidth="8" />
              <circle cx="40" cy="40" r="32" fill="none" stroke="#10b981" strokeWidth="8"
                strokeDasharray={`${(overallScore / 100) * 201} 201`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <ShieldCheck size={18} className="text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Active Rules */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 card-shadow">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Active Rules</p>
          <p className="text-3xl font-bold text-gray-900">4 Rules</p>
          <p className="text-[11px] text-indigo-500 font-semibold mt-1.5 cursor-pointer hover:underline" onClick={() => navigate('/quality/rules')}>
            Manage in rules engine →
          </p>
        </div>

        {/* Exceptions */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 card-shadow cursor-pointer hover:border-red-100 transition" onClick={() => navigate('/quality/exceptions')}>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Open Exceptions</p>
          <p className="text-3xl font-bold text-red-500">3 Pending</p>
          <p className="text-[11px] text-gray-400 font-medium mt-1.5 flex items-center gap-1">Resolve in exception list <ArrowRight size={11} /></p>
        </div>
      </div>

      {/* Dimension Metrics */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 card-shadow space-y-4">
        <h3 className="text-[13px] font-bold text-gray-900">Quality Dimensions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map(m => (
            <div key={m.name} className="border border-gray-100 rounded-xl p-4 hover:border-indigo-100 transition">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <TrendIcon trend={m.trend} />
                  <h4 className="text-[12px] font-semibold text-gray-800">{m.name}</h4>
                </div>
                <span className={`text-[13px] font-bold ${m.score >= 96 ? 'text-emerald-600' : m.score >= 93 ? 'text-blue-600' : 'text-amber-600'}`}>
                  {m.score}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                <div className="h-1.5 rounded-full transition-all duration-700"
                  style={{
                    width: `${m.score}%`,
                    background: m.score >= 96 ? 'linear-gradient(90deg,#10b981,#34d399)' : m.score >= 93 ? 'linear-gradient(90deg,#3b82f6,#60a5fa)' : 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                  }} />
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">{m.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Domain Matrix */}
      <div className="bg-white border border-gray-100 rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-[13px] font-bold text-gray-900">Domain Quality Matrix</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Domain', 'Completeness', 'Accuracy', 'Consistency', 'Uniqueness', 'Validity', 'Timeliness', 'Overall'].map(h => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {domainMetrics.map(dm => (
                <tr key={dm.domain} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3.5 text-[13px] font-semibold text-gray-800">{dm.domain}</td>
                  {[dm.completeness, dm.accuracy, dm.consistency, dm.uniqueness, dm.validity, dm.timeliness].map((v, i) => (
                    <td key={i} className="px-4 py-3.5 text-[12px] text-gray-600">{v}%</td>
                  ))}
                  <td className="px-4 py-3.5">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${dm.overallScore >= 97 ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                      {dm.overallScore}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
