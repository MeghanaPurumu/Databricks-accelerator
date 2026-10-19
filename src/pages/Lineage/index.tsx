import React, { useEffect, useState, useRef } from 'react';
import {
  Database, Network, CheckCircle, Clock, Play, RefreshCw, ChevronRight,
  ArrowRight, Sparkles, ShieldCheck, Layers, Award, Search, Filter,
  GitCommit, Eye, Server, Share2, Sliders, CheckCircle2, AlertCircle,
  FileText, ExternalLink, Cpu, LayoutGrid, Workflow, ArrowDown
} from 'lucide-react';
import { mockLineageService } from '../../services/lineageService';
import { LineageStep, SourceSystem, GoldenRecord } from '../../types';
import { getLocalStorageData, getStoredGoldenRecords } from '../../services/masterDataService';

// Default fallback source systems if none registered in localStorage
const DEFAULT_SOURCES = [
  {
    id: 'src-crm',
    label: 'CRM Customer Master',
    table: 'cora.customers',
    catalog: 'cora',
    schema: 'default',
    sub: '12,480 recs · Priority 1',
    tag: 'Unity Catalog / Delta',
    color: '#3b82f6',
    emoji: '🏢',
    priority: 1,
    records: 12480,
  },
  {
    id: 'src-pos',
    label: 'POS Loyalty Transactions',
    table: 'workspace.default.pos_loyalty',
    catalog: 'workspace',
    schema: 'default',
    sub: '8,320 recs · Priority 2',
    tag: 'Delta Lake',
    color: '#8b5cf6',
    emoji: '💳',
    priority: 2,
    records: 8320,
  },
  {
    id: 'src-web',
    label: 'Web Store & App Signup',
    table: 'ecommerce.prod.web_users',
    catalog: 'ecommerce',
    schema: 'prod',
    sub: '15,640 recs · Priority 3',
    tag: 'Databricks Parquet',
    color: '#ec4899',
    emoji: '🌐',
    priority: 3,
    records: 15640,
  },
  {
    id: 'src-support',
    label: 'Zendesk Support Tickets',
    table: 'ops.support.customer_cases',
    catalog: 'ops',
    schema: 'support',
    sub: '5,190 recs · Priority 4',
    tag: 'API Stream',
    color: '#f59e0b',
    emoji: '🎧',
    priority: 4,
    records: 5190,
  },
];

// Downstream destinations and consumers
const CONSUMERS = [
  {
    id: 'cns-gold-delta',
    label: 'Unity Catalog Gold Table',
    sub: 'mdm.gold.customer_golden_records',
    tag: 'Delta Lakehouse',
    emoji: '🏆',
    color: '#10b981',
  },
  {
    id: 'cns-stewardship',
    label: 'Data Stewardship & Review',
    sub: 'Conflict resolution & human review',
    tag: 'MDM Governance',
    emoji: '🛡️',
    color: '#f59e0b',
  },
  {
    id: 'cns-analytics',
    label: 'Customer 360 & BI',
    sub: 'Tableau, PowerBI & Databricks SQL',
    tag: 'Analytics Warehouses',
    emoji: '📊',
    color: '#3b82f6',
  },
  {
    id: 'cns-reverse-etl',
    label: 'Reverse ETL & CRM Sync',
    sub: 'Salesforce, HubSpot & Marketo',
    tag: 'Downstream Sync',
    emoji: '⚡',
    color: '#8b5cf6',
  },
  {
    id: 'cns-compliance',
    label: 'Privacy & Compliance',
    sub: 'GDPR / CCPA / HIPAA audits',
    tag: 'Data Governance',
    emoji: '🔒',
    color: '#6366f1',
  },
];

export default function LineageFlow() {
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'system' | 'record'>('system');
  const [diagramLayout, setDiagramLayout] = useState<'flow' | 'cards'>('flow');
  const [steps, setSteps] = useState<LineageStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<LineageStep | null>(null);
  const [animated, setAnimated] = useState(false);
  const [registeredSources, setRegisteredSources] = useState<any[]>([]);
  const [goldenRecords, setGoldenRecords] = useState<GoldenRecord[]>([]);
  const [selectedGoldenId, setSelectedGoldenId] = useState<string>('');
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // 1. Load registered sources from localStorage
    const savedSources = getLocalStorageData<SourceSystem[]>('lf_source_systems', []);
    if (savedSources && savedSources.length > 0) {
      const mapped = savedSources.map((s, idx) => ({
        id: s.sourceId || `src-${idx}`,
        label: s.sourceName,
        table: s.tableName ? `${s.catalog || 'workspace'}.${s.schema || 'default'}.${s.tableName}` : s.sourceName,
        catalog: s.catalog || 'workspace',
        schema: s.schema || 'default',
        sub: `${(s.recordCount || 1000).toLocaleString()} recs · Priority ${s.priority || idx + 1}`,
        tag: s.sourceType === 'delta_table' ? 'Unity Catalog / Delta' : 'Databricks Source',
        color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][idx % 5],
        emoji: ['🏢', '💳', '🌐', '🎧', '📊'][idx % 5],
        priority: s.priority || idx + 1,
        records: s.recordCount || 1000,
      }));
      setRegisteredSources(mapped);
    } else {
      setRegisteredSources(DEFAULT_SOURCES);
    }

    // 2. Load stored golden records
    const storedGold = getStoredGoldenRecords();
    if (storedGold && storedGold.length > 0) {
      setGoldenRecords(storedGold);
      setSelectedGoldenId(storedGold[0].id || storedGold[0].mdmCustomerId || 'GOLD-CUST-1');
    }

    // 3. Load pipeline steps
    mockLineageService.getSystemLineage().then(data => {
      const engineSteps: LineageStep[] = [
        {
          id: 'step-1-ingest',
          name: '1. Source Ingestion & Delta Staging',
          type: 'source',
          status: 'success',
          description: 'Securely streams data from registered Databricks Unity Catalog schemas into standardized bronze staging format with source authority priority tags.',
          timestamp: 'Live Pipeline',
          recordsCount: savedSources.reduce((acc, s) => acc + (s.recordCount || 0), 0) || 41630,
          details: {
            engine: 'Databricks SQL / Unity Catalog',
            activeSources: savedSources.length || 4,
            isolationLevel: 'Snapshot Isolation',
          },
        },
        {
          id: 'step-2-classify',
          name: '2. Column Semantic Classifier',
          type: 'ingestion',
          status: 'success',
          description: 'Evaluates config/column_classification.json to automatically detect semantic field categories (Name, Email, Phone, Address, DOB, ID) with high-confidence pattern matching.',
          timestamp: 'Live Pipeline',
          recordsCount: savedSources.reduce((acc, s) => acc + (s.recordCount || 0), 0) || 41630,
          details: {
            configFile: 'config/column_classification.json',
            recognizedCategories: 'NAME, EMAIL, PHONE, ADDRESS, DOB, RECORD_ID',
            avgConfidenceScore: '96.8%',
          },
        },
        {
          id: 'step-3-standard',
          name: '3. Data Cleaning & Standardization',
          type: 'standardization',
          status: 'success',
          description: 'Standardizes casing, strips whitespace/special characters, parses and validates RFC 5322 emails and E.164 phone formats via functions/standardization.py.',
          timestamp: 'Live Pipeline',
          recordsCount: savedSources.reduce((acc, s) => acc + (s.recordCount || 0), 0) || 41630,
          details: {
            module: 'functions/standardization.py',
            rulesExecuted: 'Email Validation, Phone E.164, Address Casing, Null Normalization',
            cleanQualityScore: '99.2%',
          },
        },
        {
          id: 'step-4-splink',
          name: '4. Splink Entity Resolution & Matcher',
          type: 'matching',
          status: 'success',
          description: 'Executes probabilistic entity resolution (Splink 4.x) using multi-tier blocking rules and Jaro-Winkler / Levenshtein string distance scoring across standardized features.',
          timestamp: 'Live Pipeline',
          recordsCount: savedSources.reduce((acc, s) => acc + (s.recordCount || 0), 0) || 41630,
          details: {
            algorithm: 'Splink 4.x + Jaro-Winkler',
            blockingRules: 'blocking on (email), (phone), (name_soundex + zip)',
            matchProbabilityThreshold: '0.85',
          },
        },
        {
          id: 'step-5-graph',
          name: '5. Connected Components Clustering',
          type: 'matching',
          status: 'success',
          description: 'Builds graph connected components clusters from matched pair probabilities, establishing unique entity cluster boundaries and validating cluster integrity.',
          timestamp: 'Live Pipeline',
          recordsCount: savedSources.reduce((acc, s) => acc + (s.recordCount || 0), 0) || 41630,
          details: {
            module: 'new_mdm_engine/cluster_validator.py',
            clusterMethod: 'Connected Components Graph',
            isolatedSingletons: '68%',
          },
        },
        {
          id: 'step-6-survivorship',
          name: '6. Attribute Survivorship Engine',
          type: 'survivorship',
          status: 'success',
          description: 'Applies config/survivorship_rules.json to determine winning field values using source authority priority (CRM > POS > Web), recency timestamps, and attribute completeness.',
          timestamp: 'Live Pipeline',
          recordsCount: 1240,
          details: {
            module: 'functions/survivorship.py',
            strategy: 'Source Authority + Most Recent Timestamp',
            conflictTracking: 'Full Field-Level Audit Trail',
          },
        },
        {
          id: 'step-7-golden',
          name: '7. Golden Record Generation & Gold Sync',
          type: 'golden_record',
          status: 'success',
          description: 'Generates persistent MDM Customer Master IDs (MDM000001) and saves single-source-of-truth golden records into Delta table mdm.gold.customer_golden_records.',
          timestamp: 'Live Pipeline',
          recordsCount: 1240,
          details: {
            targetDeltaTable: 'mdm.gold.customer_golden_records',
            idFormat: 'MDM{idx:06d}',
            activeEntitiesCount: storedGold.length || 1240,
          },
        },
      ];

      setSteps(engineSteps);
      if (engineSteps.length > 0) setSelectedStep(engineSteps[0]);
      setLoading(false);
      setTimeout(() => setAnimated(true), 100);
    }).catch(() => setLoading(false));
  }, []);

  // Currently selected golden record for detailed view
  const currentGolden: GoldenRecord | null =
    goldenRecords.find(g => (g.id === selectedGoldenId || g.mdmCustomerId === selectedGoldenId)) ||
    (goldenRecords.length > 0 ? goldenRecords[0] : null);

  // Curved path generator between two points
  const curvePath = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  // Layout constants for SVG
  const SVG_W = 960;
  const SVG_H = 470;
  const SRC_X = 24;
  const MID_X = SVG_W / 2 - 120;
  const CNS_X = SVG_W - 220;
  const SRC_CARD_W = 210;
  const CNS_CARD_W = 195;
  const SRC_H = 68;
  const CNS_H = 54;
  const SRC_GAP = 14;
  const CNS_GAP = 14;
  const GOLDEN_W = 250;
  const GOLDEN_H = 220;
  const GOLDEN_Y = (SVG_H - GOLDEN_H) / 2;

  // Y-positions for source cards
  const displaySources = registeredSources.slice(0, 5);
  const totalSrcH = displaySources.length * SRC_H + (displaySources.length - 1) * SRC_GAP;
  const srcStartY = (SVG_H - totalSrcH) / 2;
  const srcYs = displaySources.map((_, i) => srcStartY + i * (SRC_H + SRC_GAP) + SRC_H / 2);

  // Y-positions for consumer cards
  const totalCnsH = CONSUMERS.length * CNS_H + (CONSUMERS.length - 1) * CNS_GAP;
  const cnsStartY = (SVG_H - totalCnsH) / 2;
  const cnsYs = CONSUMERS.map((_, i) => cnsStartY + i * (CNS_H + CNS_GAP) + CNS_H / 2);

  const goldenMidY = GOLDEN_Y + GOLDEN_H / 2;

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="h-96 skeleton rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-6 space-y-4 md:space-y-5 overflow-y-auto max-w-7xl mx-auto w-full">
      {/* Adaptive Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 shrink-0">
            <Network size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                Enterprise Data Lineage Flow
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                mdm_engine 2.0
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Visual trace from Databricks Unity Catalog tables through MDM stages to Master Golden Records.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
          {/* View Mode Toggle (System Architecture vs Record Trace) */}
          <div className="bg-gray-100 p-1 rounded-xl flex items-center text-[11px] font-semibold">
            <button
              onClick={() => setViewMode('system')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'system'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}>
              System Flow
            </button>
            <button
              onClick={() => setViewMode('record')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'record'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}>
              Record Trace
            </button>
          </div>

          {/* Diagram Layout Toggle (Visual SVG Flow vs Adaptive Responsive Cards) */}
          {viewMode === 'system' && (
            <div className="bg-gray-100 p-1 rounded-xl flex items-center text-[11px] font-semibold">
              <button
                onClick={() => setDiagramLayout('flow')}
                title="Interactive Flow Canvas"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                  diagramLayout === 'flow'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}>
                <Workflow size={12} />
                <span className="hidden sm:inline">Flow Graph</span>
              </button>
              <button
                onClick={() => setDiagramLayout('cards')}
                title="Adaptive Cards Layout"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                  diagramLayout === 'cards'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}>
                <LayoutGrid size={12} />
                <span className="hidden sm:inline">Responsive Cards</span>
              </button>
            </div>
          )}

          <button
            onClick={() => { setAnimated(false); setTimeout(() => setAnimated(true), 50); }}
            className="text-[11px] font-semibold text-gray-600 hover:text-indigo-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition">
            <RefreshCw size={12} /> Replay
          </button>
        </div>
      </div>

      {/* Mode 1: System-Level Flow */}
      {viewMode === 'system' && (
        <div className="bg-white border border-gray-100 rounded-2xl card-shadow overflow-hidden">
          {diagramLayout === 'flow' ? (
            /* Adaptive SVG Container with full responsive scaling */
            <div
              className="relative w-full overflow-hidden p-2 sm:p-4"
              style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ede9fe 40%, #e0e7ff 75%, #fce7f3 100%)',
              }}>

              {/* Badges bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md border border-white/90 rounded-xl px-3 py-1.5 shadow-sm">
                  <div className="h-4 w-4 bg-red-500 rounded flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">db</span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-800">Databricks Unity Catalog</span>
                </div>

                <div className="flex items-center gap-2 bg-white/85 backdrop-blur-md border border-white/90 rounded-xl px-3 py-1.5 shadow-sm">
                  <div className="h-4 w-4 rounded-full flex items-center justify-center bg-indigo-600 text-white">
                    <Cpu size={9} />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-indigo-900">MDM Master Core</span>
                </div>

                <div className="hidden sm:flex items-center gap-2 bg-white/80 backdrop-blur-md border border-white/90 rounded-xl px-3 py-1.5 shadow-sm">
                  <div className="h-4 w-4 bg-emerald-500 rounded flex items-center justify-center text-white">
                    <Share2 size={9} />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-800">Downstream Consumption</span>
                </div>
              </div>

              {/* Responsive SVG Diagram */}
              <div className="w-full flex justify-center items-center overflow-x-auto">
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  className="w-full h-auto max-h-[500px] min-w-[680px] sm:min-w-[760px] md:min-w-[860px]"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* ── CURVED LINES: Sources → Golden Record Engine ── */}
                  {displaySources.map((src, i) => (
                    <path
                      key={`src-line-${i}`}
                      d={curvePath(SRC_X + SRC_CARD_W, srcYs[i], MID_X, goldenMidY)}
                      fill="none"
                      stroke={src.color}
                      strokeWidth="2.5"
                      strokeOpacity="0.65"
                      strokeLinecap="round"
                      style={
                        animated
                          ? {
                              strokeDasharray: 600,
                              strokeDashoffset: 0,
                              transition: `stroke-dashoffset ${0.9 + i * 0.15}s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.1}s`,
                            }
                          : { strokeDasharray: 600, strokeDashoffset: 600 }
                      }
                    />
                  ))}

                  {/* ── CURVED LINES: Golden Record Engine → Downstream Consumers ── */}
                  {CONSUMERS.map((con, i) => (
                    <path
                      key={`con-line-${i}`}
                      d={curvePath(MID_X + GOLDEN_W, goldenMidY, CNS_X, cnsYs[i])}
                      fill="none"
                      stroke={con.color}
                      strokeWidth="2.5"
                      strokeOpacity="0.65"
                      strokeLinecap="round"
                      style={
                        animated
                          ? {
                              strokeDasharray: 600,
                              strokeDashoffset: 0,
                              transition: `stroke-dashoffset ${0.9 + i * 0.15}s cubic-bezier(0.4, 0, 0.2, 1) ${0.4 + i * 0.1}s`,
                            }
                          : { strokeDasharray: 600, strokeDashoffset: 600 }
                      }
                    />
                  ))}

                  {/* ── SOURCE CARDS ── */}
                  {displaySources.map((src, i) => (
                    <g key={src.id} transform={`translate(${SRC_X}, ${srcYs[i] - SRC_H / 2})`}>
                      <rect
                        rx="12"
                        ry="12"
                        width={SRC_CARD_W}
                        height={SRC_H}
                        fill="white"
                        fillOpacity="0.9"
                        stroke={src.color}
                        strokeWidth="1.2"
                        style={{ filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.08))' }}
                      />
                      <rect rx="6" ry="6" x="0" y="0" width="5" height={SRC_H} fill={src.color} />
                      <text x="16" y={SRC_H / 2 - 12} fontSize="11" fontWeight="700" fill="#111827" dominantBaseline="middle">
                        {src.label}
                      </text>
                      <text x="16" y={SRC_H / 2 + 3} fontSize="9" fontWeight="500" fill="#6b7280" dominantBaseline="middle">
                        {src.table}
                      </text>
                      <rect x="16" y={SRC_H / 2 + 15} rx="6" ry="6" width={src.sub.length * 5 + 16} height="15" fill={src.color} fillOpacity="0.1" />
                      <text x="22" y={SRC_H / 2 + 25} fontSize="8" fill={src.color} fontWeight="700">
                        {src.sub}
                      </text>
                    </g>
                  ))}

                  {/* ── CENTRAL GOLDEN RECORD MASTER CARD ── */}
                  <g transform={`translate(${MID_X}, ${GOLDEN_Y})`}>
                    <rect
                      rx="18"
                      ry="18"
                      width={GOLDEN_W}
                      height={GOLDEN_H}
                      fill="white"
                      fillOpacity="0.95"
                      stroke="#818cf8"
                      strokeWidth="2"
                      style={{ filter: 'drop-shadow(0 8px 30px rgba(99,102,241,0.18))' }}
                    />
                    <text x={GOLDEN_W / 2} y="24" fontSize="11" fontWeight="800" fill="#4f46e5" textAnchor="middle">
                      MDM Master Core
                    </text>
                    <text x={GOLDEN_W / 2} y="38" fontSize="9" fill="#6b7280" textAnchor="middle">
                      Customer 360 Golden Record Engine
                    </text>

                    <rect
                      x={GOLDEN_W / 2 - 62}
                      y="50"
                      rx="8"
                      ry="8"
                      width="124"
                      height="22"
                      fill="#fef3c7"
                      stroke="#f59e0b"
                      strokeWidth="1.2"
                    />
                    <text x={GOLDEN_W / 2} y="64" fontSize="9.5" fontWeight="800" fill="#b45309" textAnchor="middle">
                      ★ Golden Record Master
                    </text>

                    <text x={GOLDEN_W / 2} y="92" fontSize="13" fontWeight="800" fill="#111827" textAnchor="middle">
                      {currentGolden?.masterName || 'Alex Morgan'}
                    </text>
                    <text x={GOLDEN_W / 2} y="106" fontSize="9" fontWeight="600" fill="#6366f1" textAnchor="middle">
                      {currentGolden?.mdmCustomerId || currentGolden?.id || 'MDM000001 · Customer'}
                    </text>

                    {[
                      ['Email', currentGolden?.primaryEmail || 'alex.morgan@email.com'],
                      ['Phone', currentGolden?.primaryPhone || '+1 (555) 019-2834'],
                      ['City/State', `${currentGolden?.city || 'New York'}, ${currentGolden?.state || 'NY'}`],
                      ['Trust Score', `${currentGolden?.qualityScore || '98.5'}% · High Authority`],
                    ].map(([k, v], idx) => (
                      <g key={k} transform={`translate(24, ${124 + idx * 19})`}>
                        <text fontSize="8.5" fill="#9ca3af" fontWeight="600">{k}:</text>
                        <text x="62" fontSize="9" fill="#374151" fontWeight="700">{v}</text>
                      </g>
                    ))}
                  </g>

                  {/* ── CONSUMER CARDS ── */}
                  {CONSUMERS.map((con, i) => (
                    <g key={con.id} transform={`translate(${CNS_X}, ${cnsYs[i] - CNS_H / 2})`}>
                      <rect
                        rx="12"
                        ry="12"
                        width={CNS_CARD_W}
                        height={CNS_H}
                        fill="white"
                        fillOpacity="0.9"
                        stroke={con.color}
                        strokeWidth="1.2"
                        style={{ filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.08))' }}
                      />
                      <rect rx="6" ry="6" x="0" y="0" width="5" height={CNS_H} fill={con.color} />
                      <text x="14" y={CNS_H / 2 - 8} fontSize="10.5" fontWeight="700" fill="#111827" dominantBaseline="middle">
                        {con.label}
                      </text>
                      <text x="14" y={CNS_H / 2 + 7} fontSize="8.5" fill="#6b7280" dominantBaseline="middle">
                        {con.sub}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          ) : (
            /* 100% Adaptive HTML/CSS Multi-Column Responsive View */
            <div className="p-4 sm:p-6 bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {/* Column 1: Source Tables */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <Database size={16} className="text-indigo-600" />
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      1. Registered Sources ({displaySources.length})
                    </h3>
                  </div>
                  <div className="space-y-2.5">
                    {displaySources.map((src) => (
                      <div
                        key={src.id}
                        className="bg-white p-3 rounded-xl border border-gray-200/80 shadow-2xs space-y-1 hover:border-indigo-300 transition">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900">{src.label}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                            P{src.priority}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-gray-500 truncate">{src.table}</p>
                        <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                          <span>{src.tag}</span>
                          <span className="font-semibold text-gray-700">{src.records.toLocaleString()} recs</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: Central Master Entity */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-indigo-200">
                    <Cpu size={16} className="text-indigo-600" />
                    <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                      2. MDM Core Engine
                    </h3>
                  </div>
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-indigo-200 shadow-md space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        ★ Golden Record Master
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
                        {currentGolden?.qualityScore || 98.5}% Quality
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-gray-900">{currentGolden?.masterName || 'Alex Morgan'}</h4>
                      <p className="text-[11px] font-semibold text-indigo-600">{currentGolden?.mdmCustomerId || 'MDM000001'}</p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-gray-100 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Email:</span>
                        <span className="font-medium text-gray-800">{currentGolden?.primaryEmail || 'alex.morgan@email.com'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Phone:</span>
                        <span className="font-medium text-gray-800">{currentGolden?.primaryPhone || '+1 (555) 019-2834'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Location:</span>
                        <span className="font-medium text-gray-800">{currentGolden?.city || 'New York'}, {currentGolden?.state || 'NY'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Cluster Size:</span>
                        <span className="font-semibold text-indigo-600">{currentGolden?.sourceRecordsCount || 3} source records</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 3: Downstream Destinations */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-200">
                    <Share2 size={16} className="text-emerald-600" />
                    <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                      3. Downstream Consumers ({CONSUMERS.length})
                    </h3>
                  </div>
                  <div className="space-y-2.5">
                    {CONSUMERS.map((cns) => (
                      <div
                        key={cns.id}
                        className="bg-white p-3 rounded-xl border border-gray-200/80 shadow-2xs space-y-1 hover:border-emerald-300 transition">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900">{cns.label}</span>
                          <span className="text-sm">{cns.emoji}</span>
                        </div>
                        <p className="text-[11px] text-gray-500">{cns.sub}</p>
                        <div className="text-[10px] text-emerald-600 font-semibold pt-0.5">{cns.tag}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Record-Level Survivorship & Lineage Trace */}
      {viewMode === 'record' && (
        <div className="space-y-4">
          {/* Golden Record Selector */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Award size={18} className="text-amber-500 shrink-0" />
              <div>
                <h3 className="text-[13px] font-bold text-gray-900">Record-Level Survivorship Trace</h3>
                <p className="text-[11px] text-gray-400">Inspect exact source contributions and winning authority rules for individual Golden Records.</p>
              </div>
            </div>

            {goldenRecords.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-500">Select Golden Record:</span>
                <select
                  value={selectedGoldenId}
                  onChange={(e) => setSelectedGoldenId(e.target.value)}
                  className="text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-full">
                  {goldenRecords.slice(0, 20).map((g) => (
                    <option key={g.id || g.mdmCustomerId} value={g.id || g.mdmCustomerId}>
                      {g.mdmCustomerId || g.id} - {g.masterName} ({g.sourceRecordsCount || 1} sources)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Survivorship Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Master Summary Card */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-indigo-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Golden Entity</span>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Quality {currentGolden?.qualityScore || 98.5}%
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-gray-900">{currentGolden?.masterName || 'Alex Morgan'}</h4>
                <p className="text-[11px] font-semibold text-indigo-600">{currentGolden?.mdmCustomerId || 'MDM000001'}</p>
                <p className="text-[11px] text-gray-500">{currentGolden?.primaryEmail || 'alex.morgan@email.com'}</p>
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Cluster Size:</span>
                  <span className="font-semibold text-gray-800">{currentGolden?.sourceRecordsCount || 3} source records</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Match Confidence:</span>
                  <span className="font-semibold text-emerald-600">{currentGolden?.confidence || 98.5}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Target Table:</span>
                  <span className="font-mono text-[10px] text-gray-700 truncate">mdm.gold.customer_golden_records</span>
                </div>
              </div>
            </div>

            {/* Field Survivorship Matrix */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm space-y-3">
              <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider">
                Attribute Survivorship & Authority Matrix
              </h4>
              <div className="space-y-2">
                {[
                  {
                    field: 'Full Name',
                    winningVal: currentGolden?.masterName || 'Alex Morgan',
                    winningSource: 'CRM Customer Master (Priority 1)',
                    rule: 'Source Authority Priority',
                    status: 'Resolved',
                  },
                  {
                    field: 'Primary Email',
                    winningVal: currentGolden?.primaryEmail || 'alex.morgan@email.com',
                    winningSource: 'POS Loyalty (Priority 2)',
                    rule: 'Recent Verified Interaction',
                    status: 'Resolved',
                  },
                  {
                    field: 'Primary Phone',
                    winningVal: currentGolden?.primaryPhone || '+1 (555) 019-2834',
                    winningSource: 'Web Store Signup (Priority 3)',
                    rule: 'Completeness & Format Validation',
                    status: 'Resolved',
                  },
                  {
                    field: 'Address & City',
                    winningVal: `${currentGolden?.city || 'New York'}, ${currentGolden?.state || 'NY'}`,
                    winningSource: 'CRM Customer Master (Priority 1)',
                    rule: 'Source Authority Priority',
                    status: 'Resolved',
                  },
                ].map((row) => (
                  <div key={row.field} className="p-3 rounded-xl border border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{row.field}</span>
                      <p className="text-[12px] font-bold text-gray-900 mt-0.5">{row.winningVal}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                        <ShieldCheck size={10} /> {row.winningSource}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">{row.rule}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Execution Stages Drawer */}
      <div className="bg-white border border-gray-100 rounded-2xl card-shadow p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
              <Layers size={15} className="text-indigo-600" />
              MDM Engine Execution Stages (`mdm_engine`)
            </h3>
            <p className="text-[11px] text-gray-400">Click any stage to inspect configuration schemas, rule parameters, and execution telemetry.</p>
          </div>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
            ✓ 7 / 7 Stages Active
          </span>
        </div>

        {/* Horizontal Pipeline Steps */}
        <div className="flex items-start gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div
                onClick={() => setSelectedStep(step)}
                className={`shrink-0 w-40 sm:w-44 cursor-pointer rounded-xl border p-3 sm:p-3.5 transition-all duration-200 ${
                  selectedStep?.id === step.id
                    ? 'border-indigo-300 bg-indigo-50/80 shadow-md shadow-indigo-100/50 ring-2 ring-indigo-500/20'
                    : 'border-gray-100 hover:border-indigo-100 hover:bg-gray-50'
                }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Step {idx + 1}</span>
                  <CheckCircle2 size={13} className="text-emerald-500" />
                </div>
                <p className="text-[11px] font-bold text-gray-800 leading-snug line-clamp-2">{step.name}</p>
                {step.recordsCount !== undefined && (
                  <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                    {step.recordsCount.toLocaleString()} recs processed
                  </p>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className="flex items-center shrink-0 px-0.5 mt-5">
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Selected Step Inspector Details */}
        {selectedStep && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-[12px] font-bold text-gray-900">{selectedStep.name}</h4>
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Active</span>
              </div>
              <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">{selectedStep.description}</p>
            </div>
            {selectedStep.details && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(selectedStep.details).map(([k, v]) => (
                  <div key={k} className="bg-white rounded-lg p-2.5 border border-gray-100 shadow-2xs">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                      {k.replace(/([A-Z])/g, ' $1').trim()}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-800 mt-0.5 truncate">{String(v)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
