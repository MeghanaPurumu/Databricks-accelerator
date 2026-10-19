import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  Check,
  AlertTriangle,
  Award,
  GitMerge,
  ShieldCheck,
  XCircle,
  Database
} from 'lucide-react';
import { mockMatchingService } from '../../services/matchingService';
import { executeMasterMergeApi } from '../../services/reviewApiService';
import { PotentialDuplicate } from '../../types';
import { formatSimilarityScore } from '../../utils/formatters';

export default function Merge() {
  const { duplicateId } = useParams<{ duplicateId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [duplicate, setDuplicate] = useState<PotentialDuplicate | null>(null);
  const [selections, setSelections] = useState<Record<string, 'A' | 'B' | 'custom'>>({});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Review item passed via navigation state if available
  const passedItem = location.state?.reviewItem;
  const passedDuplicate = location.state?.duplicate;

  useEffect(() => {
    const fetchDup = async () => {
      if (passedDuplicate) {
        setDuplicate(passedDuplicate);
        setLoading(false);
        initSelections(passedDuplicate);
        return;
      }

      if (passedItem) {
        const dupObj: PotentialDuplicate = {
          id: passedItem.review_id,
          recordA: {
            id: passedItem.left_record_id,
            name: passedItem.record_a?.name || passedItem.left_record_id,
            email: passedItem.record_a?.email || '',
            phone: passedItem.record_a?.phone || '',
            city: passedItem.record_a?.city || '',
            state: passedItem.record_a?.state || '',
            country: 'USA',
            sourceSystem: passedItem.source_a || 'CRM Customers',
            status: 'active',
            matchStatus: 'potential_duplicate',
            domain: 'customer',
            lastUpdated: new Date().toISOString(),
            attributes: passedItem.record_a || {},
          },
          recordB: {
            id: passedItem.right_record_id,
            name: passedItem.record_b?.name || passedItem.right_record_id,
            email: passedItem.record_b?.email || '',
            phone: passedItem.record_b?.phone || '',
            city: passedItem.record_b?.city || '',
            state: passedItem.record_b?.state || '',
            country: 'USA',
            sourceSystem: passedItem.source_b || 'POS Loyalty',
            status: 'active',
            matchStatus: 'potential_duplicate',
            domain: 'customer',
            lastUpdated: new Date().toISOString(),
            attributes: passedItem.record_b || {},
          },
          matchScore: passedItem.similarity_score,
          matchingAttributes: passedItem.matching_attributes || ['email', 'phone'],
          conflictingAttributes: passedItem.conflicting_attributes || ['name', 'address'],
          status: 'pending',
          hasEvidence: true,
        };
        setDuplicate(dupObj);
        setLoading(false);
        initSelections(dupObj);
        return;
      }

      if (!duplicateId) return;
      setLoading(true);
      try {
        const data = await mockMatchingService.getPotentialDuplicate(duplicateId);
        setDuplicate(data);
        if (data) {
          initSelections(data);
        }
      } catch (err) {
        console.error('Error fetching duplicate details', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDup();
  }, [duplicateId]);

  const initSelections = (data: PotentialDuplicate) => {
    const initialSelections: Record<string, 'A' | 'B' | 'custom'> = {};
    const fields = getFields(data);
    fields.forEach((field) => {
      const valA = getValue(data.recordA, field);
      const valB = getValue(data.recordB, field);
      if (valA === valB) {
        initialSelections[field] = 'A';
      } else {
        if (field === 'name' || field === 'customer_name') {
          initialSelections[field] = 'A';
        } else if (field === 'email' || field === 'phone') {
          initialSelections[field] = valA ? 'A' : 'B';
        } else {
          initialSelections[field] = valA ? 'A' : 'B';
        }
      }
    });
    setSelections(initialSelections);
  };

  const getFields = (dup: PotentialDuplicate) => {
    const coreFields = ['name', 'email', 'phone', 'address', 'city', 'state'];
    const customFields = [
      ...Object.keys(dup.recordA.attributes || {}),
      ...Object.keys(dup.recordB.attributes || {})
    ];
    return Array.from(new Set([...coreFields, ...customFields])).filter(f => !['id', 'status', 'domain', 'matchStatus', 'goldenRecordId', 'mdmCustomerId', 'lastUpdated', 'sourceSystem', 'attributes'].includes(f));
  };

  const getValue = (record: any, field: string) => {
    if (!record) return '';
    if (field in record && record[field]) {
      return String(record[field]);
    }
    if (record.attributes && field in record.attributes && record.attributes[field]) {
      return String(record.attributes[field]);
    }
    return '';
  };

  const handleSelect = (field: string, source: 'A' | 'B' | 'custom') => {
    setSelections((prev) => ({
      ...prev,
      [field]: source
    }));
  };

  const handleCustomChange = (field: string, val: string) => {
    setCustomValues((prev) => ({
      ...prev,
      [field]: val
    }));
    setSelections((prev) => ({
      ...prev,
      [field]: 'custom'
    }));
  };

  const getFinalValue = (field: string) => {
    if (!duplicate) return '';
    const sel = selections[field];
    if (sel === 'custom') {
      return customValues[field] || '';
    }
    return getValue(sel === 'B' ? duplicate.recordB : duplicate.recordA, field);
  };

  const handleConfirmMerge = async () => {
    if (!duplicate) return;
    setSubmitting(true);
    try {
      const finalAttributes: Record<string, string> = {};
      const fields = getFields(duplicate);
      fields.forEach((field) => {
        finalAttributes[field] = getFinalValue(field);
      });

      await executeMasterMergeApi({
        review_id: duplicate.id,
        entity_id: duplicate.recordA.goldenRecordId || 'ENTITY-00123',
        surviving_name: getFinalValue('name'),
        surviving_email: getFinalValue('email'),
        surviving_phone: getFinalValue('phone'),
        surviving_address: getFinalValue('address'),
      });

      await mockMatchingService.mergeRecords(duplicate.id, finalAttributes);

      setSuccessMsg(`✓ Records merged successfully into Master Entity ${duplicate.recordA.goldenRecordId || 'ENTITY-00123'}. Source lineage 100% preserved.`);
      setTimeout(() => {
        setSuccessMsg(null);
        navigate('/stewardship/queue');
      }, 2000);
    } catch (err) {
      console.error('Merge execution failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectMatch = async () => {
    if (!duplicate) return;
    setSubmitting(true);
    try {
      await mockMatchingService.rejectDuplicate(duplicate.id);
      setSuccessMsg('Match rejected. Records separated in decision registry.');
      setTimeout(() => {
        setSuccessMsg(null);
        navigate('/stewardship/queue');
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 space-y-6">
        <div className="h-8 skeleton rounded w-12"></div>
        <div className="h-48 skeleton rounded-2xl"></div>
        <div className="h-80 skeleton rounded-2xl"></div>
      </div>
    );
  }

  if (!duplicate) {
    return (
      <div className="flex-1 p-12 text-center text-[12px] text-gray-400">
        Duplicate record match payload not found.
      </div>
    );
  }

  const fields = getFields(duplicate);
  const formattedScore = formatSimilarityScore(duplicate.matchScore);

  return (
    <div className="flex-1 p-6 space-y-5 overflow-y-auto flex flex-col h-full bg-gray-50 text-gray-900">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/stewardship/queue')}
          className="text-xs text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-xs transition">
          <ChevronLeft size={15} />
          Back to Review Queue
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5">
            <ShieldCheck size={13} />
            Source Lineage Preserved
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-[12px] font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
          <Check size={16} className="text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Master Reconciliation Header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 card-shadow flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
              Master Reconciliation
            </span>
            <span className="font-mono text-[11px] font-bold text-gray-600">
              Target Entity: {duplicate.recordA.goldenRecordId || 'ENTITY-00123'}
            </span>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Side-by-Side Record Comparison & Master Merge</h2>
          <p className="text-[12px] text-gray-500 max-w-2xl">
            Select surviving attribute values across contributing source records to update the Golden Master. All non-selected values remain preserved in historical source payloads.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl px-4 py-2.5">
          <div className="text-right">
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Similarity Score</p>
            <p className="text-[18px] font-extrabold text-indigo-700">{formattedScore}</p>
          </div>
        </div>
      </div>

      {/* Main Reconciliation Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        
        {/* Attribute comparison table */}
        <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl card-shadow overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-gray-900">Attribute Survivorship Selection</h3>
            <span className="text-[11px] text-gray-500">Click a cell to select it as the surviving master value</span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">
                <th className="px-4 py-3.5 w-1/4">Attribute</th>
                <th className="px-4 py-3.5 w-5/12 border-l border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-indigo-900">{duplicate.recordA.sourceSystem}</span>
                    <span className="text-[9px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full font-bold">Source A</span>
                  </div>
                </th>
                <th className="px-4 py-3.5 w-5/12 border-l border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-violet-900">{duplicate.recordB.sourceSystem}</span>
                    <span className="text-[9px] text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full font-bold">Source B</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fields.map((field) => {
                const valA = getValue(duplicate.recordA, field);
                const valB = getValue(duplicate.recordB, field);
                const hasConflict = valA !== valB;
                const activeSelection = selections[field];

                const label = field.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

                return (
                  <tr key={field} className={hasConflict ? 'bg-amber-50/20' : ''}>
                    {/* Attribute Label */}
                    <td className="px-4 py-3.5 text-[12px] font-semibold text-gray-700 select-none">
                      <div className="flex items-center gap-1.5">
                        <span>{label}</span>
                        {hasConflict && (
                          <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" title="Conflict detected across source records"></span>
                        )}
                      </div>
                    </td>

                    {/* Value A Option */}
                    <td
                      onClick={() => handleSelect(field, 'A')}
                      className={`px-4 py-3.5 text-[12px] border-l border-gray-100 cursor-pointer transition select-none
                        ${activeSelection === 'A'
                          ? 'bg-indigo-50/80 font-bold text-indigo-900 border-indigo-200'
                          : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="break-all">{valA || <em className="text-gray-300 font-normal italic">empty</em>}</span>
                        {activeSelection === 'A' && <Check size={14} className="text-indigo-600 shrink-0 mt-0.5" />}
                      </div>
                    </td>

                    {/* Value B Option */}
                    <td
                      onClick={() => handleSelect(field, 'B')}
                      className={`px-4 py-3.5 text-[12px] border-l border-gray-100 cursor-pointer transition select-none
                        ${activeSelection === 'B'
                          ? 'bg-violet-50/80 font-bold text-violet-900 border-violet-200'
                          : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="break-all">{valB || <em className="text-gray-300 font-normal italic">empty</em>}</span>
                        {activeSelection === 'B' && <Check size={14} className="text-violet-600 shrink-0 mt-0.5" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Surviving Master Record Live Preview */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-2xl card-shadow p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Award size={16} className="text-amber-500" />
                <h3 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider">Surviving Master Value</h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Golden Preview
              </span>
            </div>

            <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4 space-y-3">
              <div>
                <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-widest mb-1">Customer Name</span>
                <span className="text-[14px] font-extrabold text-gray-900">{getFinalValue('name') || getFinalValue('customer_name') || '--'}</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-widest mb-0.5">Primary Email</span>
                  <span className="text-[12px] font-semibold text-indigo-700 break-all">{getFinalValue('email') || '--'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-widest mb-0.5">Primary Phone</span>
                  <span className="text-[12px] font-semibold text-gray-800">{getFinalValue('phone') || '--'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-widest mb-0.5">Street Address</span>
                  <span className="text-[12px] text-gray-700">{getFinalValue('address') || '--'}</span>
                </div>
              </div>
            </div>

            {/* Manual Override */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-700 block">Manual Name Override</label>
              <input
                type="text"
                placeholder="Override customer name manually..."
                value={customValues['name'] || ''}
                onChange={(e) => handleCustomChange('name', e.target.value)}
                className="w-full text-[12px] bg-gray-50 border border-gray-200 focus:border-indigo-400 focus:bg-white rounded-xl py-2 px-3 text-gray-800 placeholder-gray-400 outline-none transition"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <button
                disabled={submitting}
                onClick={handleConfirmMerge}
                className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white shadow-md shadow-indigo-100 transition flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                <GitMerge size={15} />
                <span>{submitting ? 'Merging Records…' : 'Merge Records'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  disabled={submitting}
                  onClick={handleRejectMatch}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 transition text-center">
                  Reject Match
                </button>
                <button
                  onClick={() => navigate('/stewardship/queue')}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition text-center">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
