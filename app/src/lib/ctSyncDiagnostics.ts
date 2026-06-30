/**
 * Structured CT sync diagnostics. Enable in the browser console:
 *   localStorage.setItem('lumengate:ct:diagnostics', '1')
 */

export type CtSyncTrace = {
  traceId: string;
  at: string;
  stage: string;
  account?: string;
  token?: string;
  txHash?: string;
  ledger?: number;
  detail?: Record<string, unknown>;
};

let seq = 0;

export function ctDiagnosticsEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem("lumengate:ct:diagnostics") === "1";
}

export function ctTrace(stage: string, detail?: Record<string, unknown>): string {
  const traceId = `ct-${Date.now().toString(36)}-${(seq += 1).toString(36)}`;
  if (!ctDiagnosticsEnabled()) return traceId;
  const row: CtSyncTrace = {
    traceId,
    at: new Date().toISOString(),
    stage,
    ...detail,
  };
  console.info("[ct-sync]", JSON.stringify(row));
  return traceId;
}
