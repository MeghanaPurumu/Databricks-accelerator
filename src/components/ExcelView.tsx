/**
 * ExcelView — A reusable Excel-like spreadsheet table component.
 */

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Table2 } from 'lucide-react';

export interface ExcelColumn<T = any> {
  label?: string;
  header?: string;
  key?: string;
  render?: (row: T, rowIndex: number, val?: any) => React.ReactNode;
  tdClass?: string;
  minWidth?: number;
  width?: number;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface ExcelViewProps<T = any> {
  columns: ExcelColumn<T>[];
  data: T[];
  onRowClick?: (row: T, index: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  rowKey?: (row: T, index: number) => string;
  rowHighlight?: (row: T) => boolean;
  maxHeight?: string;
  title?: string;
}

const HEADER_BG = 'linear-gradient(135deg, #1d6f42 0%, #217346 60%, #2e7d52 100%)';

const tdBase: React.CSSProperties = {
  padding: '5px 10px',
  borderRight: '1px solid #c8dfc8',
  borderBottom: '1px solid #dde8dd',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  maxWidth: 260,
  textOverflow: 'ellipsis',
};

function columnLetter(n: number): string {
  let s = '';
  n++;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function ExcelView<T = any>({
  columns,
  data,
  onRowClick,
  sortKey,
  sortDir = 'asc',
  onSort,
  loading = false,
  emptyMessage = 'No data available',
  rowKey,
  rowHighlight,
  maxHeight = 'calc(100vh - 340px)',
  title,
}: ExcelViewProps<T>) {
  return (
    <div
      className="relative overflow-auto rounded-2xl border border-[#a8c7a0] shadow-sm bg-white"
      style={{ maxHeight, fontFamily: "'Calibri', 'Segoe UI', Arial, sans-serif" }}
    >
      {title && (
        <div style={{ background: '#1d6f42', color: '#ffffff', padding: '6px 12px', fontSize: '12px', fontWeight: 700, borderBottom: '1px solid #1a5c35' }}>
          {title}
        </div>
      )}
      <table className="w-full border-collapse" style={{ fontSize: '12px', minWidth: '600px' }}>
        <thead className="sticky top-0 z-10">
          {/* Column letter row */}
          <tr>
            <th style={{ background: HEADER_BG, width: 40, minWidth: 40, borderRight: '1px solid #1a5c35', borderBottom: '1px solid #1a5c35', position: 'sticky', left: 0, zIndex: 20 }} />
            {columns.map((col, ci) => (
              <th key={ci} style={{ background: 'linear-gradient(180deg,#c6efce 0%,#a8d5b0 100%)', color: '#1d6f42', fontSize: '10px', textAlign: 'center', borderRight: '1px solid #a8c7a0', borderBottom: '1px solid #8ab89c', padding: '2px 4px', fontWeight: 600, letterSpacing: 1 }}>
                {columnLetter(ci)}
              </th>
            ))}
          </tr>
          {/* Header label row */}
          <tr>
            <th style={{ background: HEADER_BG, color: '#c6efce', fontSize: '9px', textAlign: 'center', width: 40, minWidth: 40, borderRight: '1px solid #1a5c35', borderBottom: '2px solid #145229', padding: '4px 2px', position: 'sticky', left: 0, zIndex: 20 }}>
              #
            </th>
            {columns.map((col, ci) => {
              const headerText = col.label || col.header || col.key || `Col ${ci + 1}`;
              const colWidth = col.minWidth || col.width || 80;
              return (
                <th
                  key={ci}
                  onClick={() => col.sortable !== false && col.key && onSort?.(col.key)}
                  style={{ background: HEADER_BG, color: '#e8f5e9', textAlign: col.align || 'left', borderRight: '1px solid #1a5c35', borderBottom: '2px solid #145229', padding: '7px 10px', fontWeight: 700, fontSize: '11px', letterSpacing: 0.3, whiteSpace: 'nowrap', cursor: col.sortable !== false && col.key ? 'pointer' : 'default', minWidth: colWidth, userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
                    <span>{headerText}</span>
                    {col.sortable !== false && col.key && (
                      <span style={{ opacity: sortKey === col.key ? 1 : 0.45 }}>
                        {sortKey === col.key ? (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} />}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            [...Array(10)].map((_, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f0f7f0' }}>
                <td style={{ ...tdBase, color: '#9ca3af', textAlign: 'center', fontWeight: 600, fontSize: 11, background: '#e8f5e9', borderRight: '1px solid #c6e8ca', minWidth: 40, width: 40 }}>{ri + 1}</td>
                {columns.map((_, ci) => (
                  <td key={ci} style={tdBase}><div style={{ height: 12, background: '#e5e7eb', borderRadius: 3, width: `${40 + ci * 8}%` }} /></td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '48px 16px', color: '#9ca3af', fontSize: 13 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Table2 size={28} style={{ color: '#d1d5db' }} />
                  <span style={{ fontWeight: 600 }}>{emptyMessage}</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, ri) => {
              const isHighlighted = rowHighlight?.(row) ?? false;
              const baseBg = ri % 2 === 0 ? '#ffffff' : '#f0f7f0';
              const rowBg = isHighlighted ? '#fff9c4' : baseBg;
              const key = rowKey ? rowKey(row, ri) : String(ri);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row, ri)}
                  style={{ background: rowBg, cursor: onRowClick ? 'pointer' : 'default', transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#d9ead3'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = rowBg; }}
                >
                  <td style={{ ...tdBase, color: '#6b7280', textAlign: 'center', fontWeight: 600, fontSize: 11, background: '#e8f5e9', borderRight: '1px solid #c6e8ca', minWidth: 40, width: 40 }}>{ri + 1}</td>
                  {columns.map((col, ci) => {
                    const val = col.key ? (row as any)[col.key] : undefined;
                    let content: React.ReactNode = '—';
                    if (col.render) {
                      content = col.render(row, ri, val);
                      if (content === undefined || content === null) {
                        content = val ?? '—';
                      }
                    } else {
                      content = val ?? '—';
                    }
                    return (
                      <td key={ci} style={{ ...tdBase, textAlign: col.align || 'left' }} className={col.tdClass ?? ''}>{content}</td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {data.length > 0 && !loading && (
        <div style={{ position: 'sticky', bottom: 0, background: '#217346', color: '#c6efce', fontSize: 10, padding: '3px 12px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1a5c35' }}>
          <span>Ready</span>
          <span>{data.length} row{data.length !== 1 ? 's' : ''} displayed</span>
        </div>
      )}
    </div>
  );
}

/** Toggle button for switching between Normal UI and Excel View */
export function ExcelViewToggle({ excelView, active, onToggle }: { excelView?: boolean; active?: boolean; onToggle: () => void }) {
  const isActive = excelView ?? active ?? false;
  return (
    <button
      onClick={onToggle}
      title={isActive ? 'Switch back to Normal View' : 'Switch to Excel Spreadsheet View'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
        border: isActive ? '1.5px solid #1d6f42' : '1.5px solid #d1d5db',
        background: isActive ? '#1d6f42' : '#ffffff',
        color: isActive ? '#c6efce' : '#374151',
        boxShadow: isActive ? '0 2px 8px rgba(29,111,66,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="4" fill={isActive ? '#c6efce' : '#1d6f42'} />
        <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill={isActive ? '#1d6f42' : '#fff'} fontFamily="Arial">X</text>
      </svg>
      <span>{isActive ? 'Excel View ON' : 'Excel View'}</span>
    </button>
  );
}

export default ExcelView;


