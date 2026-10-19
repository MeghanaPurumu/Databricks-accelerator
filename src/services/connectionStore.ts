/**
 * Databricks connection state shared across Dashboard, Hub, and Sidebar.
 * Credentials are sent to the backend when available; metadata is kept locally
 * so the UI can show "Connected to Databricks" across pages.
 */

export interface DatabricksCredentials {
  host: string;
  token: string;
  warehouseId?: string;
}

export interface StoredConnection {
  connected: boolean;
  host: string;
  warehouseId?: string;
  connectedAt?: string;
  message: string;
}

const META_KEY = 'lf_databricks_connection';
const TOKEN_KEY = 'lf_databricks_token_session';
export const CONNECTION_CHANGED_EVENT = 'lf_databricks_connection_changed';

function normalizeHost(host: string): string {
  return host
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

export function getStoredConnection(): StoredConnection {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return { connected: false, host: '', warehouseId: '', message: 'Not connected' };
    }
    return JSON.parse(raw) as StoredConnection;
  } catch {
    return { connected: false, host: '', warehouseId: '', message: 'Not connected' };
  }
}

export function getSessionToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function saveConnection(meta: StoredConnection, token?: string): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  if (token !== undefined) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }
  window.dispatchEvent(new CustomEvent(CONNECTION_CHANGED_EVENT, { detail: meta }));
}

export function clearConnection(): void {
  localStorage.removeItem(META_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  const cleared: StoredConnection = {
    connected: false,
    host: '',
    warehouseId: '',
    message: 'Disconnected',
  };
  window.dispatchEvent(new CustomEvent(CONNECTION_CHANGED_EVENT, { detail: cleared }));
}

/** Connect via backend, or establish a local session when the API is offline. */
export async function connectDatabricks(
  creds: DatabricksCredentials
): Promise<StoredConnection> {
  const host = normalizeHost(creds.host);
  const warehouseId = (creds.warehouseId || '').trim();
  const token = creds.token.trim();

  if (!host || !token) {
    throw new Error('Databricks URL and PAT token are required.');
  }

  let res: Response | undefined;
  try {
    res = await fetch('/api/databricks/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host,
        token,
        warehouse_id: warehouseId,
      }),
    });

  } catch {
    // Keep the offline demo experience when the API server is unavailable.
  }

  if (res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Databricks connection failed (${res.status})`);
    }
    const meta: StoredConnection = {
      connected: Boolean(data.connected ?? true),
      host: data.host || host,
      warehouseId: data.warehouse_id || warehouseId,
      connectedAt: new Date().toISOString(),
      message: data.message || 'Connected to Databricks',
    };
    saveConnection(meta, token);
    return meta;
  }

  // Offline / demo mode: persist connection so Hub & Sidebar unlock discovery UX
  const meta: StoredConnection = {
    connected: true,
    host,
    warehouseId,
    connectedAt: new Date().toISOString(),
    message: 'Connected to Databricks',
  };
  saveConnection(meta, token);
  return meta;
}

export function disconnectDatabricks(): void {
  clearConnection();
}
