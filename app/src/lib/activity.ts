export type ActivityKind = 'credential' | 'proof' | 'verify' | 'transfer' | 'freeze_check';

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  txHash?: string;
  explorerUrl?: string;
  timestamp: number;
  status: 'success' | 'error' | 'info';
};

const STORAGE_KEY = 'lumengate.activity.v1';

export function loadActivity(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityEntry[];
  } catch {
    return [];
  }
}

export function saveActivity(entries: ActivityEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 100)));
}

export function appendActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>): ActivityEntry[] {
  const full: ActivityEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const next = [full, ...loadActivity()];
  saveActivity(next);
  return next;
}

export function clearActivity(): void {
  localStorage.removeItem(STORAGE_KEY);
}
