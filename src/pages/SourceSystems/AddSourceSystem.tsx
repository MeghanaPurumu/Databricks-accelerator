import React, { useState } from 'react';
import { X, Upload, Table2, PenLine, Check, ChevronRight, Loader2 } from 'lucide-react';
import { SourceSystem, SourceType, AvailableTable, ColumnMapping } from '../../types';
import { mockSourceSystemService, autoMapColumns, MDM_TARGET_COLUMNS } from '../../services/sourceSystemService';

interface AddSourceSystemProps {
  availableTables: AvailableTable[];
  onClose: () => void;
  onSaved: (src: SourceSystem) => void;
}

type Step = 'info' | 'data' | 'mapping' | 'priority' | 'done';

const SOURCE_TYPES: { value: SourceType; label: string; desc: string; Icon: React.ElementType }[] = [
  { value: 'delta_table', label: 'Delta / Lakehouse Table', desc: 'Select from discovered tables', Icon: Table2 },
  { value: 'csv',         label: 'CSV Upload',              desc: 'Upload a .csv file',            Icon: Upload },
  { value: 'manual',      label: 'Manual Entry',            desc: 'Enter records in a grid',       Icon: PenLine },
];

export default function AddSourceSystem({ availableTables, onClose, onSaved }: AddSourceSystemProps) {
  // ── Step tracker ────────────────────────────────────────────────
  const [step, setStep]                 = useState<Step>('info');
  const [saving, setSaving]             = useState(false);

  // ── Step 1: Basic Info ──────────────────────────────────────────
  const [sourceName, setSourceName]     = useState('');
  const [sourceType, setSourceType]     = useState<SourceType>('delta_table');
  const [description, setDescription]   = useState('');
  const [priority, setPriority]         = useState(5);
  const [infoErrors, setInfoErrors]     = useState<Record<string, string>>({});

  // ── Step 2: Data Input ──────────────────────────────────────────
  // Delta table
  const [tableSearch, setTableSearch]   = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');

  // CSV
  const [csvFile, setCsvFile]           = useState<File | null>(null);
  const [csvColumns, setCsvColumns]     = useState<string[]>([]);
  const [csvRecordCount, setCsvRecordCount] = useState<number | null>(null);
  const [csvParsing, setCsvParsing]     = useState(false);

  // Manual
  const [manualColumns, setManualColumns] = useState<string[]>(['first_name', 'last_name', 'email']);
  const [manualRows, setManualRows]       = useState<Record<string, string>[]>([{}]);
  const [newColName, setNewColName]       = useState('');

  // ── Step 3: Mapping ─────────────────────────────────────────────
  const [mappings, setMappings]         = useState<ColumnMapping[]>([]);

  // Derived columns for mapping
  const getColumnsForMapping = (): string[] => {
    if (sourceType === 'delta_table') {
      return availableTables.find(t => t.tableId === selectedTableId)?.columns ?? [];
    }
    if (sourceType === 'csv') return csvColumns;
    if (sourceType === 'manual') return manualColumns;
    return [];
  };

  // ── Navigation ──────────────────────────────────────────────────
  const steps: Step[] = ['info', 'data', 'mapping', 'priority'];
  const stepLabels: Record<Step, string> = {
    info:     'Source Info',
    data:     'Data Input',
    mapping:  'Column Mapping',
    priority: 'Priority',
    done:     'Done',
  };
  const currentStepIdx = steps.indexOf(step);

  // Validate info step
  const validateInfo = () => {
    const errs: Record<string, string> = {};
    if (!sourceName.trim()) errs.sourceName = 'Source name is required';
    setInfoErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToData = () => {
    if (!validateInfo()) return;
    setStep('data');
  };

  const goToMapping = () => {
    // Auto-map columns
    const cols = getColumnsForMapping();
    if (cols.length > 0) {
      setMappings(autoMapColumns(cols));
    }
    setStep('mapping');
  };

  const goToPriority = () => setStep('priority');

  // CSV parsing (reads first line as headers)
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvParsing(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      setCsvColumns(headers);
      setCsvRecordCount(lines.length - 1);
      setCsvParsing(false);
    };
    reader.readAsText(file);
  };

  // Manual grid helpers
  const addManualColumn = () => {
    if (!newColName.trim()) return;
    setManualColumns(prev => [...prev, newColName.trim()]);
    setNewColName('');
  };

  const addManualRow = () => setManualRows(prev => [...prev, {}]);
  const removeManualRow = (i: number) => setManualRows(prev => prev.filter((_, j) => j !== i));

  const updateManualCell = (rowIdx: number, col: string, val: string) => {
    setManualRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [col]: val } : r));
  };

  // Save
  const handleSave = async () => {
    setSaving(true);
    const selectedTable = availableTables.find(t => t.tableId === selectedTableId);
    const src = await mockSourceSystemService.addSource({
      sourceName: sourceName.trim(),
      sourceType,
      catalog:    selectedTable?.catalog,
      schema:     selectedTable?.schema,
      tableName:  selectedTable?.tableName ?? sourceName.toLowerCase().replace(/\s+/g, '_'),
      fileName:   csvFile?.name,
      description,
      priority,
      status:     'active',
      recordCount: sourceType === 'delta_table'
        ? selectedTable?.recordCount
        : sourceType === 'csv' ? (csvRecordCount ?? undefined) : manualRows.length,
      columnCount: getColumnsForMapping().length || undefined,
      columnMappings: mappings,
    });
    setSaving(false);
    onSaved(src);
  };

  // ── Render ──────────────────────────────────────────────────────
  const filteredTables = availableTables.filter(t =>
    !tableSearch || t.tableName.toLowerCase().includes(tableSearch.toLowerCase()) ||
    t.schema.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(17,24,39,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Add Source System</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Step {currentStepIdx + 1} of {steps.length}</p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-4 shrink-0">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-[11px] font-semibold
                ${i <= currentStepIdx ? 'text-indigo-600' : 'text-gray-300'}`}>
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold
                  ${i < currentStepIdx ? 'bg-indigo-600 text-white' :
                    i === currentStepIdx ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400' :
                    'bg-gray-100 text-gray-300'}`}>
                  {i < currentStepIdx ? <Check size={10} /> : i + 1}
                </div>
                <span className="hidden sm:inline">{stepLabels[s]}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < currentStepIdx ? 'bg-indigo-300' : 'bg-gray-100'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── Step 1: Info ─────────────────────────────────────── */}
          {step === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                  Source Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={sourceName}
                  onChange={e => { setSourceName(e.target.value); setInfoErrors({}); }}
                  placeholder="e.g. Bronze Customer Ingest, Core Accounts Delta"
                  className={`w-full text-[13px] border rounded-xl px-3 py-2.5 outline-none transition
                    ${infoErrors.sourceName ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'}
                  `} />
                {infoErrors.sourceName && (
                  <p className="text-[11px] text-red-500 mt-1">{infoErrors.sourceName}</p>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-2">
                  Source Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {SOURCE_TYPES.map(({ value, label, desc, Icon }) => (
                    <button
                      key={value}
                      onClick={() => setSourceType(value)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition
                        ${sourceType === value
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50 text-gray-600'}`}>
                      <Icon size={20} />
                      <span className="text-[11px] font-semibold leading-tight">{label}</span>
                      <span className="text-[10px] text-gray-400 leading-tight">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional description of this source system"
                  className="w-full text-[13px] border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none" />
              </div>
            </div>
          )}

          {/* ── Step 2: Data Input ───────────────────────────────── */}
          {step === 'data' && sourceType === 'delta_table' && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-500">Select the table this source should read from.</p>
              <input
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search tables…"
                className="w-full text-[13px] border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-400 transition" />
              <div className="border border-gray-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {filteredTables.length === 0 ? (
                  <p className="text-[12px] text-gray-400 text-center py-6">No tables found</p>
                ) : filteredTables.map(t => (
                  <button
                    key={t.tableId}
                    onClick={() => setSelectedTableId(t.tableId)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition border-b border-gray-50 last:border-0
                      ${selectedTableId === t.tableId ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}>
                    <div>
                      <p className="text-[12px] font-semibold text-gray-900">{t.tableName}</p>
                      <p className="text-[10px] text-gray-400">{t.catalog}.{t.schema} · {t.columnCount} cols</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-[11px] font-bold text-gray-700">{t.recordCount.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">records</p>
                    </div>
                  </button>
                ))}
              </div>
              {selectedTableId && (
                <p className="text-[11px] text-emerald-600 font-semibold">
                  ✓ Selected: {availableTables.find(t => t.tableId === selectedTableId)?.tableName}
                </p>
              )}
            </div>
          )}

          {step === 'data' && sourceType === 'csv' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 transition">
                <Upload size={24} className="text-gray-300 mx-auto mb-3" />
                <p className="text-[13px] font-semibold text-gray-600 mb-1">Choose a CSV file</p>
                <p className="text-[11px] text-gray-400 mb-4">or drag and drop here</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[12px] font-semibold rounded-lg cursor-pointer hover:bg-indigo-700 transition">
                  <Upload size={13} />
                  Browse File
                  <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                </label>
              </div>
              {csvParsing && (
                <div className="flex items-center gap-2 text-[12px] text-indigo-600">
                  <Loader2 size={14} className="animate-spin" /> Parsing file…
                </div>
              )}
              {csvFile && !csvParsing && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2">
                  <p className="text-[12px] font-semibold text-emerald-700">✓ {csvFile.name}</p>
                  <p className="text-[11px] text-emerald-600">
                    {csvRecordCount?.toLocaleString()} records detected · {csvColumns.length} columns
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {csvColumns.slice(0, 8).map(c => (
                      <span key={c} className="text-[10px] bg-white border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-mono">{c}</span>
                    ))}
                    {csvColumns.length > 8 && (
                      <span className="text-[10px] text-emerald-500">+{csvColumns.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'data' && sourceType === 'manual' && (
            <div className="space-y-4">
              {/* Add column */}
              <div className="flex gap-2">
                <input
                  value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addManualColumn()}
                  placeholder="New column name…"
                  className="flex-1 text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 transition" />
                <button
                  onClick={addManualColumn}
                  className="px-3 py-2 bg-indigo-600 text-white text-[12px] font-semibold rounded-lg hover:bg-indigo-700 transition">
                  + Column
                </button>
              </div>

              {/* Grid */}
              <div className="border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
                <table className="min-w-full text-[12px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {manualColumns.map(col => (
                        <th key={col} className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-100 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                      <th className="px-3 py-2 border-b border-gray-100 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-gray-50 group">
                        {manualColumns.map(col => (
                          <td key={col} className="px-2 py-1.5 border-b border-gray-50">
                            <input
                              value={row[col] ?? ''}
                              onChange={e => updateManualCell(rIdx, col, e.target.value)}
                              className="w-full min-w-[80px] text-[12px] bg-transparent outline-none focus:bg-indigo-50 px-1 py-0.5 rounded transition" />
                          </td>
                        ))}
                        <td className="px-2 border-b border-gray-50">
                          <button onClick={() => removeManualRow(rIdx)}
                            className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center text-red-400 hover:text-red-600 transition rounded">
                            <X size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={addManualRow}
                className="text-[12px] text-indigo-600 hover:text-indigo-700 font-semibold">
                + Add Row
              </button>
            </div>
          )}

          {/* ── Step 3: Mapping ──────────────────────────────────── */}
          {step === 'mapping' && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-500">
                Map source columns to the MDM standard schema. Fields marked * are required for processing.
              </p>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_70px] gap-2 px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span>Source Column</span>
                  <span>MDM Target</span>
                  <span>Confidence</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {mappings.map((m, idx) => (
                    <div key={m.sourceColumn} className="grid grid-cols-[1fr_1fr_70px] gap-2 items-center px-4 py-2.5 hover:bg-gray-50 transition">
                      <span className="font-mono text-[11px] text-gray-700 truncate">{m.sourceColumn}</span>
                      <select
                        value={m.targetColumn}
                        onChange={e => setMappings(prev => prev.map((mp, i) =>
                          i === idx ? { ...mp, targetColumn: e.target.value } : mp
                        ))}
                        className={`text-[11px] border rounded-lg px-2 py-1.5 outline-none transition
                          ${m.targetColumn ? 'border-indigo-200 bg-indigo-50/40 text-indigo-700 font-semibold' : 'border-gray-200 text-gray-400'}`}>
                        {MDM_TARGET_COLUMNS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <span className={`text-[10px] font-semibold ${
                        !m.confidence ? 'text-gray-300' :
                        m.confidence >= 0.9 ? 'text-emerald-600' :
                        m.confidence >= 0.7 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {!m.confidence ? '—' : m.confidence >= 0.9 ? 'High' : m.confidence >= 0.7 ? 'Med' : 'Low'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Priority ─────────────────────────────────── */}
          {step === 'priority' && (
            <div className="space-y-4">
              <p className="text-[12px] text-gray-500">
                Set the priority for this source. Lower number = higher priority in survivorship rules.
              </p>
              <div className="flex items-center gap-4">
                <label className="text-[12px] font-semibold text-gray-700">Priority</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={priority}
                  onChange={e => setPriority(Number(e.target.value))}
                  className="w-24 text-[14px] font-bold text-center border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 transition" />
                <span className="text-[11px] text-gray-400">
                  {priority === 1 ? '🥇 Highest trust' : priority <= 3 ? '🥈 High trust' : priority <= 6 ? 'Medium trust' : 'Lower trust'}
                </span>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-indigo-700 mb-2">Ready to save</p>
                <div className="space-y-1.5">
                  {[
                    ['Name',     sourceName],
                    ['Type',     sourceType.replace('_', ' ')],
                    ['Table',    availableTables.find(t => t.tableId === selectedTableId)?.tableName ?? csvFile?.name ?? 'manual'],
                    ['Priority', String(priority)],
                    ['Mappings', `${mappings.filter(m => m.targetColumn).length} / ${mappings.length} columns`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-[11px]">
                      <span className="text-indigo-500 font-semibold">{label}</span>
                      <span className="text-indigo-800 font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => {
              if (step === 'data')     setStep('info');
              else if (step === 'mapping') setStep('data');
              else if (step === 'priority') setStep('mapping');
              else onClose();
            }}
            className="text-[13px] text-gray-500 hover:text-gray-700 font-semibold transition">
            {step === 'info' ? 'Cancel' : '← Back'}
          </button>

          {step === 'info' && (
            <button onClick={goToData}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)' }}>
              Continue <ChevronRight size={14} />
            </button>
          )}
          {step === 'data' && (
            <button
              disabled={sourceType === 'delta_table' && !selectedTableId}
              onClick={goToMapping}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)' }}>
              Map Columns <ChevronRight size={14} />
            </button>
          )}
          {step === 'mapping' && (
            <button onClick={goToPriority}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a78bfa)' }}>
              Set Priority <ChevronRight size={14} />
            </button>
          )}
          {step === 'priority' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#10b981,#34d399)' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Saving…' : 'Save Source System'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
