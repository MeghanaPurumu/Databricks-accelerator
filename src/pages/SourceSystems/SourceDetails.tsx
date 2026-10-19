import React, { useState } from 'react';
import {
  X, Database, Table2, Calendar, Hash, Activity,
  Edit3, PowerOff, Play, Eye, ArrowUpDown, Trash2, AlertTriangle
} from 'lucide-react';
import { SourceSystem } from '../../types';
import { fetchTableData } from '../../services/databricksApiService';

interface SourceDetailsProps {
  source: SourceSystem;
  onClose: () => void;
  onEdit: (src: SourceSystem) => void;
  onDisable: (src: SourceSystem) => void;
  onDelete: (src: SourceSystem) => void;
  onRunProcessing: (src: SourceSystem) => void;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  active:     { label: 'Active',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  inactive:   { label: 'Inactive',   cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  processing: { label: 'Processing', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  error:      { label: 'Error',      cls: 'bg-red-50 text-red-700 border-red-100' },
};

export default function SourceDetails({
  source, onClose, onEdit, onDisable, onDelete, onRunProcessing
}: SourceDetailsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = STATUS_CFG[source.status] ?? STATUS_CFG.inactive;
  const [sampleRows, setSampleRows] = React.useState<Record<string, any>[]>([]);
  const [loadingSample, setLoadingSample] = React.useState(false);

  React.useEffect(() => {
    if (source.catalog && source.schema && source.tableName) {
      setLoadingSample(true);
      fetchTableData(source.catalog, source.schema, source.tableName, 5)
        .then(res => setSampleRows(res.rows || []))
        .catch(() => setSampleRows([]))
        .finally(() => setLoadingSample(false));
    }
  }, [source.catalog, source.schema, source.tableName]);

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="text-[13px] font-semibold text-gray-800">{value}</span>
    </div>
  );

  const mappedCount = source.columnMappings?.filter(m => m.targetColumn).length ?? 0;
  const totalCols   = source.columnMappings?.length ?? source.columnCount ?? 0;


  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end"
      style={{ background: 'rgba(17,24,39,0.35)', backdropFilter: 'blur(3px)' }}>
      <div className="bg-white h-full sm:h-auto sm:max-h-[90vh] w-full sm:max-w-md shadow-2xl flex flex-col sm:rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
          style={{ background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-[12px] font-bold">
              {source.sourceName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">{source.sourceName}</h2>
              <p className="text-[11px] text-gray-400">{source.sourceId}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/60 transition">
            <X size={16} />
          </button>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${status.cls}`}>
            <Activity size={10} />
            {status.label}
          </span>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Source Type"
              value={source.sourceType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} />
            <Field label="Priority" value={`#${source.priority}`} />
            <Field label="Catalog"  value={source.catalog ?? '—'} />
            <Field label="Schema"   value={source.schema ?? '—'} />
            <Field label="Table"    value={
              <span className="font-mono text-indigo-600">{source.tableName ?? source.fileName ?? '—'}</span>
            } />
            <Field label="Records" value={source.recordCount?.toLocaleString() ?? '—'} />
            <Field label="Created"
              value={new Date(source.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
            <Field label="Last Updated"
              value={new Date(source.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
          </div>

          {/* Description */}
          {source.description && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Description</p>
              <p className="text-[12px] text-gray-600">{source.description}</p>
            </div>
          )}

          {/* Column Mapping summary */}
          {(source.columnMappings?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Column Mappings</p>
                <span className="text-[10px] text-indigo-600 font-semibold">{mappedCount}/{totalCols} mapped</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {source.columnMappings!.map(m => (
                  <div key={m.sourceColumn}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-50 text-[11px]">
                    <span className="font-mono text-gray-600">{m.sourceColumn}</span>
                    <span className="text-gray-400 mx-2">→</span>
                    <span className={`font-semibold ${m.targetColumn ? 'text-indigo-600' : 'text-gray-300'}`}>
                      {m.targetColumn || 'unmapped'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Live Databricks sample records preview */}
          {source.tableName && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Live Databricks Preview
                </p>
                {loadingSample && (
                  <span className="text-[10px] text-indigo-500 font-semibold animate-pulse">Loading live rows…</span>
                )}
              </div>
              {sampleRows.length > 0 ? (
                <div className="border border-gray-200 rounded-xl overflow-x-auto max-h-48 text-[11px]">
                  <table className="w-full divide-y divide-gray-200 text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(sampleRows[0]).slice(0, 5).map(col => (
                          <th key={col} className="px-2.5 py-1.5 font-semibold text-gray-600 truncate">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {sampleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/20">
                          {Object.keys(sampleRows[0]).slice(0, 5).map(col => (
                            <td key={col} className="px-2.5 py-1.5 text-gray-700 font-mono truncate max-w-[120px]">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                !loadingSample && (
                  <p className="text-[11px] text-gray-400 italic">No sample preview records found</p>
                )
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2 shrink-0">
          {confirmDelete ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-red-800 text-[12px] font-semibold">
                <AlertTriangle size={14} className="text-red-600 shrink-0" />
                <span>Delete & Unregister table "{source.tableName || source.sourceName}"?</span>
              </div>
              <p className="text-[11px] text-red-600">
                This will remove the source from MDM and clean up its mapped master/golden records.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onDelete(source)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 transition">
                  Confirm Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => onRunProcessing(source)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition"
                style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)' }}>
                <Play size={14} />
                Run Processing
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onEdit(source)}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                  <Edit3 size={12} />
                  Edit
                </button>
                <button
                  onClick={() => onDisable(source)}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold border border-amber-200 text-amber-700 hover:bg-amber-50 transition">
                  <PowerOff size={12} />
                  Disable
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition">
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
