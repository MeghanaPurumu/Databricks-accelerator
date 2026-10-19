import React, { useState } from 'react';
import {
  Settings as SettingsIcon, Save, Server, Sliders, CheckCircle2, Bell, ShieldCheck, User
} from 'lucide-react';

const FieldGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{label}</label>
    {children}
  </div>
);

const TextInput = ({ value, onChange, mono = false }: { value: string; onChange: (v: string) => void; mono?: boolean }) => (
  <input type="text" value={value} onChange={e => onChange(e.target.value)}
    className={`w-full bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:bg-white rounded-xl py-2 px-3 text-[13px] text-gray-700 outline-none transition ${mono ? 'font-mono' : ''}`} />
);

export default function Settings() {
  const [matchThreshold, setMatchThreshold] = useState(85);
  const [databricksUrl, setDatabricksUrl] = useState('https://adb-1039824.7.azuredatabricks.net');
  const [dbClusterId, setDbClusterId] = useState('0819-124018-nodes4');
  const [defaultSteward, setDefaultSteward] = useState('Jane Doe');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'connection' | 'matching' | 'notifications' | 'access'>('connection');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const tabs = [
    { id: 'connection', label: 'Connection', icon: Server },
    { id: 'matching', label: 'Matching Engine', icon: Sliders },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'access', label: 'Access', icon: ShieldCheck },
  ] as const;

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <SettingsIcon size={18} className="text-gray-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">System Settings</h2>
          <p className="text-[12px] text-gray-400">Configure MDM engine, Databricks connections, matching thresholds and governance.</p>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3.5 rounded-xl text-[12px] font-semibold flex items-center gap-2">
          <CheckCircle2 size={14} /> Configuration saved successfully.
        </div>
      )}

      <div className="flex gap-5 flex-1">
        {/* Sidebar Tabs */}
        <div className="w-44 shrink-0 space-y-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 text-[12px] font-semibold px-3 py-2.5 rounded-xl transition-all
                ${activeTab === id ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
              <Icon size={14} className={activeTab === id ? 'text-indigo-500' : 'text-gray-400'} />
              {label}
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <form onSubmit={handleSave} className="flex-1 bg-white border border-gray-100 rounded-2xl card-shadow p-6 space-y-5">
          {activeTab === 'connection' && (
            <>
              <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                <Server size={16} className="text-blue-500" />
                <h3 className="text-[13px] font-bold text-gray-900">Delta Lake Ingestion Connection</h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <FieldGroup label="Databricks Workspace URL">
                  <TextInput value={databricksUrl} onChange={setDatabricksUrl} mono />
                </FieldGroup>
                <FieldGroup label="Active Processing Cluster ID">
                  <TextInput value={dbClusterId} onChange={setDbClusterId} mono />
                </FieldGroup>
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="h-2 w-2 bg-emerald-400 rounded-full shrink-0"></div>
                  <p className="text-[11px] font-semibold text-emerald-700">Connection healthy · Last sync 2 minutes ago</p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'matching' && (
            <>
              <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                <Sliders size={16} className="text-indigo-500" />
                <h3 className="text-[13px] font-bold text-gray-900">Entity Resolution Engine</h3>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manual Review Threshold</label>
                    <span className="text-[12px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">{matchThreshold}% similarity</span>
                  </div>
                  <input type="range" min="50" max="98" value={matchThreshold}
                    onChange={e => setMatchThreshold(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  <p className="text-[11px] text-gray-400">Matches scoring below this limit are rejected automatically.</p>
                </div>
                <FieldGroup label="Default Assignee Steward">
                  <select value={defaultSteward} onChange={e => setDefaultSteward(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-[13px] py-2 px-3 rounded-xl outline-none cursor-pointer focus:border-indigo-300 transition">
                    <option>Jane Doe</option>
                    <option>Mark Johnson</option>
                    <option>Unassigned</option>
                  </select>
                </FieldGroup>
                <div className="grid grid-cols-2 gap-4">
                  {[['Fuzzy Matching', 'Levenshtein distance algorithm'], ['ML Scoring', 'Gradient boosted classifier'], ['Block Keys', 'Last name + ZIP code'], ['Survivorship', 'Trust-score ranked sources']].map(([k, v]) => (
                    <div key={k} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{k}</p>
                      <p className="text-[12px] font-semibold text-gray-700">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                <Bell size={16} className="text-amber-500" />
                <h3 className="text-[13px] font-bold text-gray-900">Notification Preferences</h3>
              </div>
              <div className="space-y-3">
                {[['Duplicate match detected', true], ['Quality exception raised', true], ['Golden record updated', false], ['Stewardship task assigned', true], ['Batch job completed', false]].map(([label, active]) => (
                  <div key={String(label)} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-[13px] text-gray-700 font-medium">{label as string}</span>
                    <div className={`h-6 w-11 rounded-full flex items-center transition-all cursor-pointer ${active ? 'bg-indigo-500 justify-end pr-0.5' : 'bg-gray-200 justify-start pl-0.5'}`}>
                      <div className="h-5 w-5 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'access' && (
            <>
              <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
                <ShieldCheck size={16} className="text-emerald-500" />
                <h3 className="text-[13px] font-bold text-gray-900">Access Control</h3>
              </div>
              <div className="space-y-3">
                {[{ name: 'Jane Doe', role: 'Senior Data Steward', domains: 'All Domains', status: 'active' }, { name: 'Mark Johnson', role: 'Data Steward', domains: 'Customer, Product', status: 'active' }, { name: 'Alice Chen', role: 'Analyst (Read-only)', domains: 'Customer', status: 'inactive' }].map(u => (
                  <div key={u.name} className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white text-[11px] font-bold">
                        {u.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-gray-800">{u.name}</p>
                        <p className="text-[11px] text-gray-400">{u.role} · {u.domains}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400'}`}>{u.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button type="submit"
              className="text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-indigo-200">
              <Save size={13} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
