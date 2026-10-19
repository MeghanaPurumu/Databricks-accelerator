import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  X,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Search
} from 'lucide-react';
import { mockQualityService } from '../../services/qualityService';
import { BusinessRule } from '../../types';

// ─── Severity Badge ───────────────────────────────────────────────────────────
const SeverityBadge = ({ severity }: { severity: BusinessRule['severity'] }) => {
  const styles: Record<string, { cls: string; icon: React.ReactNode }> = {
    critical: {
      cls: 'bg-red-50 text-red-700 border-red-200',
      icon: <XCircle size={9} className="shrink-0" />
    },
    warning: {
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <AlertTriangle size={9} className="shrink-0" />
    },
    info: {
      cls: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <Info size={9} className="shrink-0" />
    }
  };
  const s = styles[severity] ?? styles.info;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${s.cls}`}>
      {s.icon}{severity}
    </span>
  );
};

// ─── Status Pill ──────────────────────────────────────────────────────────────
const StatusPill = ({ active }: { active: boolean }) =>
  active ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
      <CheckCircle2 size={9} className="shrink-0" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-400 border-gray-200">
      <XCircle size={9} className="shrink-0" /> Disabled
    </span>
  );

// ─── Label ────────────────────────────────────────────────────────────────────
const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
    {children}
  </label>
);

// ─── Form Input ───────────────────────────────────────────────────────────────
const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-full text-[12px] bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-xl py-2 px-3 text-gray-700 placeholder-gray-300 outline-none transition"
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select
    {...props}
    className="w-full text-[12px] bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-xl py-2 px-3 text-gray-700 outline-none transition cursor-pointer"
  />
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RulesEngine() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRule, setNewRule] = useState<Omit<BusinessRule, 'id' | 'createdBy' | 'lastUpdated'>>({
    ruleName: '',
    domain: 'customer',
    attribute: '',
    condition: '',
    severity: 'warning',
    status: 'active'
  });

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await mockQualityService.getRules();
      setRules(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRules(); }, []);

  const handleToggle = async (id: string) => {
    await mockQualityService.toggleRuleStatus(id);
    loadRules();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this validation rule?')) return;
    await mockQualityService.deleteRule(id);
    loadRules();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.ruleName || !newRule.attribute || !newRule.condition) return;
    await mockQualityService.createRule(newRule);
    setIsModalOpen(false);
    setNewRule({ ruleName: '', domain: 'customer', attribute: '', condition: '', severity: 'warning', status: 'active' });
    loadRules();
  };

  const filtered = rules.filter(r =>
    !search ||
    r.ruleName.toLowerCase().includes(search.toLowerCase()) ||
    r.attribute?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = rules.filter(r => r.status === 'active').length;
  const criticalCount = rules.filter(r => r.severity === 'critical').length;

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full bg-gray-50/40">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-indigo-50 flex items-center justify-center shadow-sm">
            <Sliders size={19} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-[17px] font-black text-gray-900 leading-tight">Governance Rules Engine</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Configure validation rules, format filters and condition thresholds enforced on incoming ingestion streams.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-xl font-semibold transition shadow-sm shadow-indigo-200 self-start sm:self-center whitespace-nowrap"
        >
          <Plus size={13} /> Add Custom Rule
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Rules', value: rules.length, icon: ShieldCheck, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
          { label: 'Active', value: activeCount, icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { label: 'Critical Severity', value: criticalCount, icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-500' }
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-100 rounded-2xl p-4 card-shadow flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
              <card.icon size={16} className={card.iconColor} />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-medium">{card.label}</p>
              <p className="text-xl font-black text-gray-900 leading-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 card-shadow flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rules or attributes..."
            className="w-full text-[12px] bg-gray-50 border border-gray-200 focus:border-indigo-300 rounded-lg py-1.5 pl-8 pr-4 text-gray-700 placeholder-gray-400 outline-none transition"
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')}
            className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 transition">
            <RefreshCw size={10} /> Clear
          </button>
        )}
        <div className="ml-auto">
          <button onClick={loadRules}
            className="text-[11px] text-gray-400 hover:text-indigo-600 flex items-center gap-1.5 transition font-medium">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Rules Table ── */}
      <div className="bg-white border border-gray-100 rounded-2xl card-shadow flex-1 flex flex-col overflow-hidden min-h-[300px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                {['Rule Identifier', 'Domain', 'Attribute', 'Condition Pattern', 'Severity', 'Status', 'Last Updated', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-3.5 skeleton rounded" style={{ width: `${50 + j * 12}px` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                        <Sliders size={20} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-gray-400">No rules found</p>
                        <p className="text-[11px] text-gray-300 mt-0.5">Add a custom rule or clear your search filter.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(rule => {
                  const isActive = rule.status === 'active';
                  return (
                    <tr key={rule.id} className={`hover:bg-indigo-50/20 transition ${!isActive ? 'opacity-50' : ''}`}>
                      {/* Rule Name */}
                      <td className="px-4 py-3.5">
                        <p className="text-[12px] font-bold text-gray-900">{rule.ruleName}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{rule.id}</p>
                      </td>

                      {/* Domain */}
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 uppercase">
                          {rule.domain}
                        </span>
                      </td>

                      {/* Attribute */}
                      <td className="px-4 py-3.5">
                        <code className="text-[11px] bg-gray-50 border border-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md font-mono">
                          {rule.attribute || 'all'}
                        </code>
                      </td>

                      {/* Condition */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <code className="text-[10px] font-mono text-gray-500 break-all leading-relaxed">
                          {rule.condition}
                        </code>
                      </td>

                      {/* Severity */}
                      <td className="px-4 py-3.5">
                        <SeverityBadge severity={rule.severity} />
                      </td>

                      {/* Status Toggle */}
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggle(rule.id)}
                            title={isActive ? 'Disable rule' : 'Enable rule'}
                            className={`transition-colors ${isActive ? 'text-emerald-500 hover:text-emerald-600' : 'text-gray-300 hover:text-gray-400'}`}
                          >
                            {isActive ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                          </button>
                          <StatusPill active={isActive} />
                        </div>
                      </td>

                      {/* Updated */}
                      <td className="px-4 py-3.5 text-[11px] text-gray-400 whitespace-nowrap">
                        {rule.lastUpdated}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          title="Delete rule"
                          className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition ml-auto"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <span className="text-[11px] text-gray-400">
            Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of{' '}
            <span className="font-semibold text-gray-600">{rules.length}</span> rules
          </span>
        </div>
      </div>

      {/* ── Add Rule Drawer Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-end animate-fadeIn"
          onClick={e => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-gray-100 animate-slideInLeft">

            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Plus size={15} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-black text-gray-900">Configure Ingestion Rule</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Define a new data quality constraint</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Form */}
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Rule Name */}
              <div>
                <Label>Rule Identifier Name *</Label>
                <Input
                  required
                  placeholder="e.g. VALID_EMAIL_FORMAT"
                  value={newRule.ruleName}
                  onChange={e => setNewRule({ ...newRule, ruleName: e.target.value })}
                />
                <p className="text-[10px] text-gray-400 mt-1">Use uppercase snake_case for consistency.</p>
              </div>

              {/* Domain */}
              <div>
                <Label>Domain Scope *</Label>
                <Select
                  value={newRule.domain}
                  onChange={e => setNewRule({ ...newRule, domain: e.target.value as any })}
                >
                  <option value="customer">Customer</option>
                </Select>
              </div>

              {/* Attribute */}
              <div>
                <Label>Target Attribute *</Label>
                <Input
                  required
                  placeholder="e.g. email, postalCode, phone"
                  value={newRule.attribute}
                  onChange={e => setNewRule({ ...newRule, attribute: e.target.value })}
                />
              </div>

              {/* Condition */}
              <div>
                <Label>Condition Expression *</Label>
                <textarea
                  required
                  rows={3}
                  placeholder={`e.g. MATCHES ^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,4}$`}
                  value={newRule.condition}
                  onChange={e => setNewRule({ ...newRule, condition: e.target.value })}
                  className="w-full text-[12px] bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-xl py-2 px-3 text-gray-700 placeholder-gray-300 outline-none transition font-mono resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">Enforced during silver staging cleaning runs.</p>
              </div>

              {/* Severity */}
              <div>
                <Label>Severity Threshold</Label>
                <Select
                  value={newRule.severity}
                  onChange={e => setNewRule({ ...newRule, severity: e.target.value as any })}
                >
                  <option value="critical">Critical — Halts ingestion sync</option>
                  <option value="warning">Warning — Logs stewardship exception</option>
                  <option value="info">Info — Records metadata warning</option>
                </Select>

                {/* Severity Preview */}
                <div className="mt-2">
                  <SeverityBadge severity={newRule.severity as any} />
                </div>
              </div>

              {/* Severity legend */}
              <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1.5">
                  <AlertTriangle size={10} /> Severity Guide
                </p>
                <ul className="text-[10px] text-amber-700/80 space-y-0.5 leading-relaxed">
                  <li><strong>Critical</strong> — blocks the silver run; record fails validation entirely.</li>
                  <li><strong>Warning</strong> — record is flagged; stewardship task created automatically.</li>
                  <li><strong>Info</strong> — noted in logs only; no downstream impact.</li>
                </ul>
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 text-[12px] font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 py-2.5 rounded-xl transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleCreate}
                className="flex-1 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl transition shadow-sm shadow-indigo-200 flex items-center justify-center gap-1.5"
              >
                <ChevronRight size={13} /> Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
