import React, { useEffect, useState } from 'react';
import { Sliders, Plus, CheckCircle, XCircle, AlertTriangle, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { mockQualityService } from '../../services/qualityService';
import { BusinessRule } from '../../types';

export default function RulesEngine() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<BusinessRule[]>([]);

  const load = async () => {
    setLoading(true);
    const data = await mockQualityService.getRules();
    setRules(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: string) => {
    await mockQualityService.toggleRuleStatus(id);
    load();
  };

  const SeverityBadge = ({ s }: { s: string }) => {
    const m: Record<string, string> = { critical: 'bg-red-50 text-red-700 border-red-200', high: 'bg-orange-50 text-orange-700 border-orange-200', medium: 'bg-amber-50 text-amber-700 border-amber-200', low: 'bg-blue-50 text-blue-700 border-blue-200' };
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${m[s] || m.low}`}>{s}</span>;
  };

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Sliders size={18} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Quality Rules Engine</h2>
            <p className="text-[12px] text-gray-400">Configure validation rules that enforce data quality standards.</p>
          </div>
        </div>
        <button className="text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-4 rounded-xl font-semibold transition shadow-sm shadow-indigo-200 flex items-center gap-1.5">
          <Plus size={13} /> Add Rule
        </button>
      </div>

      {/* Rules list */}
      <div className="space-y-3 flex-1">
        {loading ? [...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton rounded-2xl" />) :
          rules.map(rule => {
            const isActive = rule.status === 'active';
            return (
              <div key={rule.id} className={`bg-white border rounded-2xl p-5 card-shadow transition-all ${isActive ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h4 className="text-[13px] font-bold text-gray-900">{rule.ruleName}</h4>
                      <SeverityBadge s={rule.severity} />
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-semibold">{rule.domain}</span>
                      {isActive
                        ? <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5"><CheckCircle size={9} /> Active</span>
                        : <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5"><XCircle size={9} /> Disabled</span>
                      }
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">Condition: <code className="bg-gray-50 border border-gray-100 px-1 py-0.5 rounded font-mono text-[11px] text-gray-600">{rule.condition}</code></p>
                    <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">Target Attribute:</span>
                        <code className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-mono">{rule.attribute || 'all'}</code>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => toggle(rule.id)}
                      className={`h-8 w-14 rounded-full flex items-center transition-all ${isActive ? 'bg-emerald-500 justify-end pr-1' : 'bg-gray-200 justify-start pl-1'}`}>
                      <div className="h-6 w-6 bg-white rounded-full shadow-sm" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
