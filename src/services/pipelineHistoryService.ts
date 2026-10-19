/**
 * Persist MDM pipeline run history for the Dashboard "Pipeline Runs" tab.
 */

export interface PipelineRunRecord {
  runId: string;
  name: string;
  domain: string;
  mdmId: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING';
  recordsProcessed: number;
  goldenGenerated: number;
  duration: string;
  error?: string;
}

const KEY = 'lf_pipeline_runs';
export const PIPELINE_RUNS_CHANGED_EVENT = 'lf_pipeline_runs_changed';

export function getPipelineRuns(): PipelineRunRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePipelineRun(run: PipelineRunRecord): void {
  const existing = getPipelineRuns();
  const next = [run, ...existing.filter(r => r.runId !== run.runId)].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PIPELINE_RUNS_CHANGED_EVENT));
}

export function recordSuccessfulPipeline(opts: {
  mdmId: string;
  mdmName: string;
  recordsProcessed: number;
  goldenGenerated: number;
  durationMs?: number;
}): PipelineRunRecord {
  const durationSec = ((opts.durationMs ?? 800) / 1000).toFixed(1);
  const run: PipelineRunRecord = {
    runId: `RUN-MDM-${Date.now().toString(36).toUpperCase()}`,
    name: `${opts.mdmName} Master Pipeline`,
    domain: opts.mdmName,
    mdmId: opts.mdmId,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    status: 'SUCCESS',
    recordsProcessed: opts.recordsProcessed,
    goldenGenerated: opts.goldenGenerated,
    duration: `${durationSec}s`,
  };
  savePipelineRun(run);
  return run;
}

export function getPipelineMetrics(runs: PipelineRunRecord[]) {
  const total = runs.length;
  const succeeded = runs.filter(r => r.status === 'SUCCESS').length;
  const failed = runs.filter(r => r.status === 'FAILED').length;
  const successRate = total === 0 ? 100 : Math.round((succeeded / total) * 1000) / 10;
  return { total, succeeded, failed, successRate };
}
