import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Database,
  Award,
  GitBranch,
  ShieldCheck,
  History,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Edit3,
  Tag,
  Mail,
  Phone,
  Network
} from 'lucide-react';
import { mockMasterDataService } from '../../services/masterDataService';
import { mockLineageService } from '../../services/lineageService';
import { mockQualityService } from '../../services/qualityService';
import { MasterRecord, SourceRecord, LineageStep, QualityException, GoldenRecord } from '../../types';

export default function RecordDetails() {
  const { domain, id } = useParams<{ domain: string; id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<MasterRecord | null>(null);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [lineageSteps, setLineageSteps] = useState<LineageStep[]>([]);
  const [exceptions, setExceptions] = useState<QualityException[]>([]);
  const [goldenRecord, setGoldenRecord] = useState<GoldenRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'attributes' | 'sources' | 'quality' | 'lineage' | 'audit' | 'attr_lineage'>('attributes');
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [selectedPhone, setSelectedPhone] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const rec = await mockMasterDataService.getRecord(id);
        setRecord(rec);

        if (rec) {
          const srcList = await mockMasterDataService.getSourceRecords(id);
          setSources(srcList);

          const linSteps = await mockLineageService.getRecordLineage(id);
          setLineageSteps(linSteps);

          const excList = await mockQualityService.getExceptions({ domain: rec.domain });
          setExceptions(excList.filter((e) => e.recordId === id));

          // Load linked golden record for attribute lineage
          if (rec.goldenRecordId) {
            const gr = await mockMasterDataService.getGoldenRecord(rec.goldenRecordId);
            setGoldenRecord(gr);
          }
        }
      } catch (err) {
        console.error('Error fetching record details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 p-8 space-y-6">
        <div className="h-8 skeleton rounded w-12"></div>
        <div className="h-24 skeleton rounded-2xl"></div>
        <div className="h-10 skeleton rounded w-2/3"></div>
        <div className="h-80 skeleton rounded-2xl"></div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex-1 p-12 text-center space-y-4">
        <div className="h-12 w-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center border border-red-100 mx-auto">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Record not found</h3>
        <p className="text-xs text-gray-400">The record with ID "{id}" does not exist in our master catalog.</p>
        <button onClick={() => navigate(-1)} className="text-xs bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-600 py-1.5 px-4 rounded-lg font-semibold transition">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full">
      {/* Header Back Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(`/master-data/${record.domain}`)}
          className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[12px] text-gray-400 font-medium">Back to {record.domain}s list</span>
      </div>

      {/* Record Overview Banner Card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 card-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-wide capitalize">
              {record.domain} Record
            </span>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-gray-400 text-[12px] font-mono">{record.id}</span>
            {/* MDM Customer ID badge */}
            {record.attributes?.mdmCustomerId && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                <Tag size={9} />
                {String(record.attributes.mdmCustomerId)}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{record.name}</h2>
          <div className="flex items-center gap-4 text-[12px] text-gray-400 font-medium flex-wrap">
            <span>Last Updated: <strong className="text-gray-600">{record.lastUpdated}</strong></span>
            <span>Source: <strong className="text-gray-600">{record.sourceSystem}</strong></span>
            {record.attributes?.dataQualityScore !== undefined && (
              <span className="inline-flex items-center gap-1">
                Quality: <strong className="text-emerald-600">{String(record.attributes.dataQualityScore)}/100</strong>
              </span>
            )}
          </div>
        </div>

        {record.goldenRecordId && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <Award size={18} className="text-amber-500" />
            <div>
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider leading-none">Consolidated Golden Record</p>
              <button
                onClick={() => navigate('/golden-records')}
                className="text-[12px] font-bold text-gray-800 flex items-center gap-1 hover:text-indigo-600 mt-1 transition"
              >
                <span>{record.goldenRecordId}</span>
                <ExternalLink size={11} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Navigation Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto select-none shrink-0">
        {[
          { id: 'attributes',    label: 'Overview & Attributes',                                   Icon: Database },
          { id: 'sources',       label: `Source Records (${sources.length})`,                      Icon: Database },
          { id: 'attr_lineage',  label: 'Attribute Lineage',                                       Icon: Network  },
          { id: 'quality',       label: `Data Quality (${exceptions.length === 0 ? 'Passed' : exceptions.length + ' Issue'})`, Icon: ShieldCheck },
          { id: 'lineage',       label: 'Trace Lineage',                                           Icon: GitBranch },
          { id: 'audit',         label: 'Audit History',                                           Icon: History  }
        ].map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 border-b-2 text-[12px] font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer
                ${active
                  ? 'border-indigo-500 text-indigo-700 bg-indigo-50/40'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <Icon size={13} className={active ? 'text-indigo-500' : 'text-gray-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels Contents */}
      <div className="bg-white border border-gray-100 rounded-2xl card-shadow flex-1 p-5 min-h-[300px]">
        
        {/* TAB 1: Attributes Grid */}
        {activeTab === 'attributes' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Core Master Attributes</h3>
                <span className="text-[10px] text-gray-400 font-medium">Click on attributes below to switch between discovered source system values</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Name */}
                <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Name</span>
                  <span className="text-[13px] font-semibold text-gray-800 mt-1 block">{record.name}</span>
                </div>

                {/* Email with Multi-Source Dropdown */}
                {record.email && record.email !== 'n/a' && record.email.includes('@') && (
                  <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide flex items-center gap-1">
                        <Mail size={10} className="text-blue-500" /> Email
                      </span>
                      {goldenRecord?.alternateEmails && goldenRecord.alternateEmails.length > 1 && (
                        <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-100">
                          {goldenRecord.alternateEmails.length} sources
                        </span>
                      )}
                    </div>
                    {goldenRecord?.alternateEmails && goldenRecord.alternateEmails.length > 1 ? (
                      <div className="pt-0.5">
                        <select
                          value={selectedEmail || record.email}
                          onChange={(e) => setSelectedEmail(e.target.value)}
                          className="w-full text-[12px] font-semibold font-mono bg-white border border-gray-200 rounded-lg p-1.5 text-gray-800 outline-none focus:border-blue-400 transition"
                        >
                          {goldenRecord.alternateEmails.map((e, idx) => (
                            <option key={idx} value={e.email}>
                              {e.email} — {e.source} {e.is_primary ? '(Primary)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-[13px] font-semibold text-gray-800 mt-1 block font-mono">{record.email}</span>
                    )}
                  </div>
                )}

                {/* Phone with Multi-Source Dropdown */}
                {record.phone !== 'n/a' && (
                  <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide flex items-center gap-1">
                        <Phone size={10} className="text-purple-500" /> Phone
                      </span>
                      {goldenRecord?.alternatePhones && goldenRecord.alternatePhones.length > 1 && (
                        <span className="text-[9px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-100">
                          {goldenRecord.alternatePhones.length} sources
                        </span>
                      )}
                    </div>
                    {goldenRecord?.alternatePhones && goldenRecord.alternatePhones.length > 1 ? (
                      <div className="pt-0.5">
                        <select
                          value={selectedPhone || record.phone}
                          onChange={(e) => setSelectedPhone(e.target.value)}
                          className="w-full text-[12px] font-semibold font-mono bg-white border border-gray-200 rounded-lg p-1.5 text-gray-800 outline-none focus:border-purple-400 transition"
                        >
                          {goldenRecord.alternatePhones.map((p, idx) => (
                            <option key={idx} value={p.phone}>
                              {p.phone} — {p.source} {p.is_primary ? '(Primary)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-[13px] font-semibold text-gray-800 mt-1 block font-mono">{record.phone}</span>
                    )}
                  </div>
                )}

                {/* City */}
                {record.city !== 'n/a' && (
                  <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
                    <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">City</span>
                    <span className="text-[13px] font-semibold text-gray-800 mt-1 block">{record.city}</span>
                  </div>
                )}

                {/* State */}
                {record.state !== 'n/a' && (
                  <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
                    <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">State / Region</span>
                    <span className="text-[13px] font-semibold text-gray-800 mt-1 block">{record.state}</span>
                  </div>
                )}

                {/* Country */}
                {record.country !== 'n/a' && (
                  <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
                    <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">Country</span>
                    <span className="text-[13px] font-semibold text-gray-800 mt-1 block">{record.country}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Multi-Source Discovered Contact Points */}
            {goldenRecord && ((goldenRecord.alternateEmails && goldenRecord.alternateEmails.length > 0) || (goldenRecord.alternatePhones && goldenRecord.alternatePhones.length > 0)) && (
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Multi-Source Discovered Contact Points</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* All Discovered Emails */}
                  {goldenRecord.alternateEmails && goldenRecord.alternateEmails.length > 0 && (
                    <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl space-y-2">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide flex items-center gap-1.5">
                        <Mail size={12} className="text-blue-500" />
                        All Discovered Emails ({goldenRecord.alternateEmails.length})
                      </span>
                      <div className="space-y-1.5">
                        {goldenRecord.alternateEmails.map((e, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[12px] bg-white p-2 rounded-lg border border-gray-100">
                            <span className="font-semibold text-gray-800 font-mono">{e.email}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{e.source}</span>
                              {e.is_primary ? (
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-100">Primary</span>
                              ) : (
                                <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded border border-blue-100">Alternate</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Discovered Phones */}
                  {goldenRecord.alternatePhones && goldenRecord.alternatePhones.length > 0 && (
                    <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl space-y-2">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide flex items-center gap-1.5">
                        <Phone size={12} className="text-purple-500" />
                        All Discovered Phones ({goldenRecord.alternatePhones.length})
                      </span>
                      <div className="space-y-1.5">
                        {goldenRecord.alternatePhones.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[12px] bg-white p-2 rounded-lg border border-gray-100">
                            <span className="font-semibold text-gray-800 font-mono">{p.phone}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p.source}</span>
                              {p.is_primary ? (
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-100">Primary</span>
                              ) : (
                                <span className="text-[9px] bg-purple-50 text-purple-600 font-bold px-1.5 py-0.5 rounded border border-purple-100">Alternate</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom attributes */}
            {Object.keys(record.attributes).length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Domain Extension Attributes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(record.attributes).map(([key, val]) => (
                    <div key={key} className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wide">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className="text-[13px] font-semibold text-gray-800 mt-1 block">
                        {typeof val === 'number' ? val.toLocaleString() : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Source System Mappings */}
        {activeTab === 'sources' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Contributing Source System Records</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">These source-system records are merged based on matching attributes.</p>
              </div>
              <span className="text-[10px] bg-gray-100 text-gray-500 font-semibold px-3 py-1 rounded-full">
                {sources.length} sources
              </span>
            </div>

            {sources.length === 0 ? (
              <div className="py-12 text-center text-[12px] text-gray-400">
                No raw source mapping records found contributing to this master record.
              </div>
            ) : (
              <div className="space-y-4">
                {sources.map((src) => (
                  <div key={src.id} className="border border-gray-100 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 bg-indigo-400 rounded-full"></span>
                        <span className="text-[12px] font-bold text-gray-800">{src.systemName}</span>
                        <span className="text-[11px] text-gray-400 font-mono">#{src.systemRecordId}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-gray-400 font-medium">Trust score:</span>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          {src.trustScore}%
                        </span>
                        <span className="text-[10px] text-gray-400">Synced: {src.lastUpdated}</span>
                      </div>
                    </div>
                    {/* Attributes contributed */}
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {Object.entries(src.attributes).map(([key, val]) => (
                        <div key={key} className="bg-gray-50 border border-gray-100 p-2.5 rounded-lg">
                          <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wide">{key}</span>
                          <span className="text-[11px] text-gray-700 font-semibold block mt-0.5 truncate">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Data Quality */}
        {activeTab === 'quality' && (
          <div className="space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Quality Rule Verifications</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Automated validation rules executing on {record.domain} attributes.</p>
            </div>

            {exceptions.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={13} />
                  <span>Unresolved Quality Exceptions ({exceptions.length})</span>
                </h4>
                {exceptions.map((exc) => (
                  <div key={exc.id} className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 border border-red-200 rounded-full uppercase">
                          {exc.severity}
                        </span>
                        <strong className="text-[12px] font-semibold text-gray-800">Rule: {exc.ruleName}</strong>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Current Value: <code className="text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded text-[11px]">{exc.currentValue}</code>
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Expected: <span className="text-gray-700 font-medium">{exc.expectedValue}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/quality/exceptions')}
                      className="text-[11px] bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 py-1.5 px-3 rounded-lg font-semibold transition flex items-center gap-1"
                    >
                      <Edit3 size={12} />
                      <span>Resolve</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-xl flex items-center gap-4">
                <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                <div>
                  <h4 className="text-[13px] font-bold text-emerald-700">All Quality Checks Passed</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    This master record complies with active corporate governance schemas. No open exceptions detected.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Lineage Trace */}
        {activeTab === 'lineage' && (
          <div className="space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Record Consolidation Lineage</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Data flow showing how source records resolve into this master record.</p>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-6 select-none relative">
              {/* Source column */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center block">Source Records</span>
                {sources.map((src) => (
                  <div key={src.id} className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl w-52 flex items-start gap-2.5 card-shadow">
                    <Database size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-[12px] font-bold text-gray-800">{src.systemName}</p>
                      <p className="text-[10px] text-gray-400">#{src.systemRecordId}</p>
                      <p className="text-[10px] text-emerald-600 font-semibold">Trust: {src.trustScore}%</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Match Node */}
              <div className="flex flex-col items-center">
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-full w-24 h-24 flex flex-col justify-center items-center text-center card-shadow">
                  <ShieldCheck size={20} className="text-indigo-500" />
                  <p className="text-[9px] text-indigo-500 font-bold uppercase mt-1">Match &</p>
                  <p className="text-[9px] text-indigo-500 font-bold uppercase">Cleanse</p>
                </div>
              </div>

              {/* Golden Output */}
              <div className="flex flex-col gap-3 items-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center block">Consolidated Master</span>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl w-52 flex items-start gap-2.5 card-shadow">
                  <Award size={18} className="text-amber-500 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[12px] font-bold text-gray-800">{record.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{record.id}</p>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded-full leading-none">Golden Record</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button onClick={() => navigate('/lineage')}
                className="text-[12px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1.5 transition">
                View Full Processing Lineage <ChevronLeft size={12} className="rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* TAB: Attribute Lineage */}
        {activeTab === 'attr_lineage' && (
          <div className="space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Attribute Lineage</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Which source system contributed the surviving value for each attribute in the golden record.
              </p>
            </div>

            {goldenRecord?.attributeLineage ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(goldenRecord.attributeLineage).map(([field, info]) => {
                  const sourceColors: Record<string, string> = {
                    crm:     'bg-blue-50 text-blue-700 border-blue-100',
                    pos:     'bg-purple-50 text-purple-700 border-purple-100',
                    web:     'bg-teal-50 text-teal-700 border-teal-100',
                    support: 'bg-orange-50 text-orange-700 border-orange-100',
                    consensus: 'bg-gray-50 text-gray-500 border-gray-200',
                    unknown: 'bg-gray-50 text-gray-400 border-gray-200',
                  };
                  const src = String(info.source ?? 'unknown').toLowerCase();
                  const clr = sourceColors[src] || sourceColors.unknown;
                  return (
                    <div key={field} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide block">
                          {field.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[13px] font-semibold text-gray-800 block truncate mt-0.5">
                          {info.value ?? <span className="text-gray-300 italic">null</span>}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-0.5 block font-mono">{info.source_record_id}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide flex-shrink-0 ${clr}`}>
                        {src}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-300">
                <Network size={32} className="mx-auto mb-3" />
                <p className="text-[13px] font-semibold text-gray-400">No attribute lineage data available</p>
                <p className="text-[11px] text-gray-400 mt-1">Re-run the pipeline to populate attribute lineage.</p>
              </div>
            )}

            {/* Alt Emails from golden record */}
            {goldenRecord?.alternateEmails && goldenRecord.alternateEmails.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Alternate Emails</h4>
                <div className="space-y-2">
                  {goldenRecord.alternateEmails.map((ae, i) => (
                    <div key={i} className="flex items-center gap-3 text-[12px] bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <Mail size={12} className="text-blue-400 flex-shrink-0" />
                      <span className="font-medium text-blue-800">{ae.email}</span>
                      <span className="text-[10px] text-blue-400 ml-auto">from {ae.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alt Phones from golden record */}
            {goldenRecord?.alternatePhones && goldenRecord.alternatePhones.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Alternate Phones</h4>
                <div className="space-y-2">
                  {goldenRecord.alternatePhones.map((ap, i) => (
                    <div key={i} className="flex items-center gap-3 text-[12px] bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                      <Phone size={12} className="text-purple-400 flex-shrink-0" />
                      <span className="font-medium text-purple-800">{ap.phone}</span>
                      <span className="text-[10px] text-purple-400 ml-auto">from {ap.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Audit History */}
        {activeTab === 'audit' && (
          <div className="space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Audit Log History</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Version tracking events of updates, merges, approvals, and data owner changes.</p>
            </div>

            <div className="relative border-l-2 border-gray-100 pl-6 ml-3 space-y-6 py-2">
              {[{
                color: 'bg-emerald-400', title: 'Golden Record Sync Completed',
                time: '2026-08-19 11:25:00 · System Agent',
                desc: 'Consolidated record GOLD-CUST-101 created and pushed downstream to BI tables.'
              }, {
                color: 'bg-indigo-400', title: 'SAP ERP Sync Processed',
                time: '2026-08-19 11:22:15 · SAP ERP Agent',
                desc: 'Ingested new address properties into silver staging. Match flag raised: potential duplicate with CRM.'
              }, {
                color: 'bg-blue-400', title: 'Salesforce CRM Initial Ingest',
                time: '2026-08-19 10:15:30 · Salesforce Connector',
                desc: 'Primary customer entity records loaded into bronze storage tier.'
              }].map((ev, i) => (
                <div key={i} className="relative">
                  <span className={`absolute top-1.5 -left-[31px] h-3 w-3 ${ev.color} rounded-full border-2 border-white ring-1 ring-gray-200`}></span>
                  <div>
                    <h4 className="text-[13px] font-semibold text-gray-800">{ev.title}</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">{ev.time}</p>
                    <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">{ev.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
