/**
 * Lumengate issuer-service CT event backfill adapter.
 *
 * The issuer exposes `GET /ct/events` with pre-decoded rows (see
 * `issuer-service/lib/confidentialIndexer.js`). The Goldsky Worker client in
 * `indexer.ts` expects a different API (`/contracts/:id/events`), so pointing
 * `VITE_CONFIDENTIAL_INDEXER_URL` at the issuer `/ct` path silently 404'd and
 * hybrid sync lost all pre-window history. This adapter speaks the issuer API
 * and normalizes rows into {@link ConfidentialEvent} for {@link hybridFetchEvents}.
 */

import { fromBytesBE, hexToBytes } from "../crypto/field.js";
import { Grumpkin, type Point } from "../crypto/grumpkin.js";
import {
  buildConfidentialEvent,
  type ConfidentialEvent,
  type EventRef,
  type FetchEventsResult,
} from "./events.js";
import type { IndexerHealth } from "./indexer.js";

/** Pre-decoded row shape returned by `GET /ct/events`. */
export interface IssuerCtEventRow {
  id: string;
  ledger: number;
  txHash: string;
  type: string;
  account?: string;
  from?: string;
  to?: string;
  amount?: string;
  auditorId?: number;
  sigma?: string;
  rE?: { x: string; y: string };
  vTilde?: string;
  bTilde?: string;
  vAudR?: string;
  rAudR?: string;
  vAudS?: string;
  bAudS?: string;
}

interface IssuerCtEventsResponse {
  events: IssuerCtEventRow[];
  latestLedger: number;
  cursor: string | null;
}

function parseHexField(value: string | undefined): bigint {
  if (!value) throw new Error("missing field element");
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  return fromBytesBE(hexToBytes(hex));
}

function parseHexPoint(value: { x: string; y: string } | undefined): Point {
  if (!value) throw new Error("missing point");
  const x = parseHexField(value.x);
  const y = parseHexField(value.y);
  if (x === 0n && y === 0n) return Grumpkin.ZERO;
  return Grumpkin.fromAffine({ x, y });
}

/** Convert one issuer row into a {@link ConfidentialEvent}, or null if unsupported. */
export function parseIssuerCtEvent(row: IssuerCtEventRow): ConfidentialEvent | null {
  const base = { ledger: row.ledger, txHash: row.txHash, cursor: row.id };
  const addr = (field: "account" | "from" | "to"): string => {
    const value = row[field];
    if (!value) throw new Error(`issuer CT event "${row.type}" missing ${field}`);
    return value;
  };
  const data = {
    field: (name: string) => {
      const map: Record<string, string | undefined> = {
        sigma: row.sigma,
        v_tilde: row.vTilde,
        b_tilde: row.bTilde,
        v_aud_r: row.vAudR,
        r_aud_r: row.rAudR,
        v_aud_s: row.vAudS,
        b_aud_s: row.bAudS,
      };
      return parseHexField(map[name]);
    },
    point: (name: string) => (name === "r_e" ? parseHexPoint(row.rE) : parseHexPoint(undefined)),
    i128: (name: string) => {
      if (name !== "amount" || row.amount === undefined) throw new Error(`missing i128 ${name}`);
      return BigInt(row.amount);
    },
    u32: (name: string) => {
      if (name !== "auditor_id" || row.auditorId === undefined) {
        throw new Error(`missing u32 ${name}`);
      }
      return row.auditorId;
    },
  };

  try {
    switch (row.type) {
      case "register":
        return buildConfidentialEvent("register", base, (i) => (i === 1 ? addr("account") : ""), data);
      case "deposit":
        return buildConfidentialEvent(
          "deposit",
          base,
          (i) => (i === 1 ? addr("from") : i === 2 ? addr("to") : ""),
          data,
        );
      case "merge":
        return buildConfidentialEvent("merge", base, (i) => (i === 1 ? addr("account") : ""), data);
      case "transfer":
        return buildConfidentialEvent(
          "transfer",
          base,
          (i) => (i === 1 ? addr("from") : i === 2 ? addr("to") : ""),
          data,
        );
      case "withdraw":
        // Issuer rows omit withdraw payload fields required to rebuild spendable
        // openings; those events must come from RPC within the retention window.
        return null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export class IssuerCtIndexerClient {
  constructor(readonly cfg: { baseUrl: string; assetKey?: 'eurc' | 'usdc' }) {}

  private base(): string {
    return this.cfg.baseUrl.replace(/\/$/, "");
  }

  private eventsPath(startLedger?: number): string {
    const params = new URLSearchParams();
    if (this.cfg.assetKey) params.set("asset", this.cfg.assetKey);
    if (startLedger !== undefined) params.set("fromLedger", String(startLedger));
    const qs = params.toString();
    return `${this.base()}/ct/events${qs ? `?${qs}` : ""}`;
  }

  async health(): Promise<IndexerHealth> {
    const resp = await fetch(this.eventsPath());
    if (!resp.ok) return { latestSyncedLedger: 0 };
    const body = (await resp.json()) as IssuerCtEventsResponse;
    return { latestSyncedLedger: Number(body.latestLedger ?? 0) };
  }

  async fetchEvents(opts: {
    contractId: string;
    startLedger?: number;
    endLedger?: number;
    pageLimit?: number;
  }): Promise<FetchEventsResult> {
    void opts.contractId;
    void opts.pageLimit;
    const resp = await fetch(this.eventsPath(opts.startLedger));
    if (!resp.ok) {
      throw new Error(`issuer CT events ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    }
    const body = (await resp.json()) as IssuerCtEventsResponse;
    const end = opts.endLedger ?? Number.MAX_SAFE_INTEGER;
    const events: ConfidentialEvent[] = [];
    for (const row of body.events ?? []) {
      if (row.ledger < (opts.startLedger ?? 0) || row.ledger > end) continue;
      const ev = parseIssuerCtEvent(row);
      if (ev) events.push(ev);
    }
    return { events, cursor: undefined, latestLedger: body.latestLedger ?? 0 };
  }

  async resolveEventRef(_contractId: string, ref: EventRef): Promise<ConfidentialEvent | null> {
    const resp = await fetch(this.eventsPath(ref.ledger));
    if (!resp.ok) return null;
    const body = (await resp.json()) as IssuerCtEventsResponse;
    const match = (body.events ?? [])
      .map(parseIssuerCtEvent)
      .find((ev): ev is ConfidentialEvent => ev !== null && ev.cursor === ref.id);
    if (!match || match.txHash !== ref.txHash) return null;
    return match;
  }
}
