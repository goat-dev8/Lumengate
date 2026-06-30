/**
 * State reconstruction from the contract event stream.
 *
 * Replays confidential-token events to recover the local openings (`v`, `r`) of
 * an account's spendable and receiving balances — the secrets needed to build
 * the next proof. Events come from the hybrid source (`chain/event-source.ts`):
 * the RPC `getEvents` API for the recent tail, plus an optional Goldsky indexer
 * for history older than the RPC's ~7-day retention window.
 *
 * Reconstruction rules (owner = `state.address`):
 *   - register(me)        → mark registered.
 *   - deposit(_, me)      → receiving += (amount, 0)   [deposits carry r = 0].
 *   - transfer(other, me) → ECDH-decrypt (v_tx, r_tx); receiving += (v_tx, r_tx).
 *   - merge(me)           → spendable += receiving; receiving = (0, 0).
 *   - withdraw(me, _)     → spendable = open(b_tilde, sigma)  [event encodes v_new].
 *   - transfer(me, _)     → spendable = open(b_tilde, sigma).
 *
 * Why the spendable rule needs no history: withdraw/transfer emit
 * `b_tilde = v_new + Poseidon2(ENC_BAL, vk, sigma)`, so the owner reads the
 * resulting spendable value straight from the event. The receiving balance,
 * however, is a running sum — every crediting event must be replayed. With
 * RPC alone those openings are only recoverable inside the ~7-day window, so a
 * client must persist state and sync at least once per retention period. A
 * configured indexer lifts this: crediting events stay available for the full
 * history, so a fresh client can reconstruct the receiving balance from scratch.
 */

import { commit, ecdh, type Point } from "../crypto/grumpkin.js";
import { frAdd, frMod } from "../crypto/field.js";
import { DOMAIN } from "../crypto/constants.js";
import { deriveSpendR, deriveTxBlind, poseidonWithDomain } from "../crypto/poseidon2.js";
import type { KeyPair } from "../crypto/keys.js";
import type { ChainClient } from "../chain/client.js";
import { type ConfidentialEvent } from "../chain/events.js";
import { hybridFetchEvents } from "../chain/event-source.js";
import type { IndexerClient } from "../chain/indexer.js";
import type { StateStore } from "./store.js";
import { freshState, type AccountState, type Opening } from "./types.js";

export type WaitUntilVerifiedOptions = {
  afterTxHash?: string;
  rpcUrl?: string;
  maxAttempts?: number;
  intervalMs?: number;
  requireSpendable?: boolean;
  requireReceiving?: boolean;
  skipSync?: boolean;
  /** When false, never discard optimistic local state via rebuildFromEvents. */
  allowRebuild?: boolean;
};

export interface StateEngineConfig {
  client: ChainClient;
  store: StateStore;
  /** Owner's confidential key set (for ECDH decryption + balance opening). */
  keys: KeyPair;
  /** Owner's Stellar (G-) address (for event direction). */
  address: string;
  /**
   * Ledger to start the FIRST sync from (e.g. the contract deploy ledger).
   * When an {@link indexer} is provided this may predate the RPC retention
   * window — the hybrid source backfills the gap from the indexer.
   */
  fromLedger: number;
  /**
   * Optional Goldsky indexer for full-history backfill below the RPC's ~7-day
   * window. When omitted, sync is RPC-only (the original behavior): events
   * older than retention are unavailable.
   */
  indexer?: IndexerClient;
}

export class StateEngine {
  constructor(private cfg: StateEngineConfig) {}

  /** Recover an incoming transfer's amount and blinding from its event. */
  decryptIncoming(rE: Point, vTilde: bigint, sigma: bigint): { vTx: bigint; rTx: bigint } {
    const s = ecdh(this.cfg.keys.vk, rE);
    const vTx = frMod(vTilde - poseidonWithDomain(DOMAIN.TX_AMOUNT, [s, sigma]));
    const rTx = deriveTxBlind(s, sigma);
    return { vTx, rTx };
  }

  /** Recover the owner's post-op spendable opening from an emitted b_tilde. */
  openSpendable(bTilde: bigint, sigma: bigint): Opening {
    const v = frMod(bTilde - poseidonWithDomain(DOMAIN.ENCRYPTED_BALANCE, [this.cfg.keys.vk, sigma]));
    const r = deriveSpendR(this.cfg.keys.vk, sigma);
    return { v, r };
  }

  /** Apply one event in-place to `state`. */
  private apply(state: AccountState, ev: ConfidentialEvent): void {
    if (state.optimisticTxHashes?.includes(ev.txHash)) {
      state.syncedLedger = Math.max(state.syncedLedger, ev.ledger);
      return;
    }
    const me = state.address;
    switch (ev.type) {
      case "register":
        if (ev.account === me) state.registered = true;
        break;
      case "deposit":
        if (ev.to === me) state.receiving.v += ev.amount;
        break;
      case "merge":
        if (ev.account === me) {
          state.spendable = {
            v: state.spendable.v + state.receiving.v,
            r: frAdd(state.spendable.r, state.receiving.r),
          };
          state.receiving = { v: 0n, r: 0n };
        }
        break;
      case "withdraw":
        if (ev.from === me) state.spendable = this.openSpendable(ev.bTilde, ev.sigma);
        break;
      case "transfer":
        // Order matters for a self-transfer: the sender's spendable is set from
        // the event, and the recipient credit is added to receiving.
        if (ev.from === me) state.spendable = this.openSpendable(ev.bTilde, ev.sigma);
        if (ev.to === me) {
          const { vTx, rTx } = this.decryptIncoming(ev.rE, ev.vTilde, ev.sigma);
          state.receiving = {
            v: state.receiving.v + vTx,
            r: frAdd(state.receiving.r, rTx),
          };
        }
        break;
    }
    state.syncedLedger = Math.max(state.syncedLedger, ev.ledger);
  }

  /**
   * Sync from the last cursor (or `fromLedger` on first run), applying every
   * relevant event, then persist. Returns the updated state.
   */
  async sync(): Promise<AccountState> {
    const prior = await this.cfg.store.load(this.cfg.address);
    const state = prior ?? freshState(this.cfg.address);

    const { events, cursor, latestLedger } = await hybridFetchEvents(
      this.cfg.client,
      this.cfg.indexer,
      { fromLedger: this.cfg.fromLedger, startCursor: state.cursor },
    );

    for (const ev of events) this.apply(state, ev);
    if (cursor) state.cursor = cursor;
    state.syncedLedger = Math.max(state.syncedLedger, latestLedger);

    await this.cfg.store.save(state);
    return state;
  }

  /** Rebuild local openings from the event stream, ignoring any cached cursor/state. */
  async rebuildFromEvents(): Promise<AccountState> {
    const state = freshState(this.cfg.address);
    const { events, cursor, latestLedger } = await hybridFetchEvents(
      this.cfg.client,
      this.cfg.indexer,
      { fromLedger: this.cfg.fromLedger },
    );

    for (const ev of events) this.apply(state, ev);
    if (cursor) state.cursor = cursor;
    state.syncedLedger = Math.max(state.syncedLedger, latestLedger);

    await this.cfg.store.save(state);
    return state;
  }

  /** Read current state without syncing (or a fresh zero-state). */
  async current(): Promise<AccountState> {
    return (await this.cfg.store.load(this.cfg.address)) ?? freshState(this.cfg.address);
  }

  /**
   * Optimistically overwrite the cached spendable opening after a successful
   * owner op, avoiding a round-trip wait for the event to land. A later
   * {@link sync} reconciles against the chain.
   */
  async setSpendable(next: Opening): Promise<AccountState> {
    const state = await this.current();
    state.spendable = { ...next };
    await this.cfg.store.save(state);
    return state;
  }

  /**
   * Strong correctness check: the cached openings must re-commit to the exact
   * points stored on-chain. Mismatch means the local state diverged (a missed
   * event, an expired credit, or a bug) and is unsafe to spend from.
   */
  async verifyAgainstChain(): Promise<{ ok: boolean; spendableOk: boolean; receivingOk: boolean }> {
    const state = await this.current();
    const onchain = await this.cfg.client.confidentialBalance(this.cfg.address);
    if (!onchain) return { ok: false, spendableOk: false, receivingOk: false };
    const spendableOk = commit(state.spendable.v, state.spendable.r).equals(onchain.spendableBalance);
    const receivingOk = commit(state.receiving.v, state.receiving.r).equals(onchain.receivingBalance);
    return { ok: spendableOk && receivingOk, spendableOk, receivingOk };
  }

  /** Credit receiving locally after a deposit tx is confirmed (events may lag behind RPC). */
  async creditReceiving(amount: bigint, txHash?: string): Promise<AccountState> {
    const state = await this.current();
    state.receiving = { v: state.receiving.v + amount, r: state.receiving.r };
    if (txHash) {
      state.optimisticTxHashes = [...new Set([...(state.optimisticTxHashes ?? []), txHash])];
    }
    await this.cfg.store.save(state);
    return state;
  }

  /** Move receiving into spendable locally after a merge tx is confirmed. */
  async applyMergeLocal(txHash?: string): Promise<AccountState> {
    const state = await this.current();
    state.spendable = {
      v: state.spendable.v + state.receiving.v,
      r: frAdd(state.spendable.r, state.receiving.r),
    };
    state.receiving = { v: 0n, r: 0n };
    if (txHash) {
      state.optimisticTxHashes = [...new Set([...(state.optimisticTxHashes ?? []), txHash])];
    }
    await this.cfg.store.save(state);
    return state;
  }

  /**
   * Poll event replay until local openings match on-chain commitments.
   * Soroban RPC event indexing can lag behind transaction SUCCESS.
   */
  async waitUntilVerified(options?: WaitUntilVerifiedOptions): Promise<AccountState> {
    if (options?.afterTxHash && options.rpcUrl) {
      const { waitForTransactionStatus } = await import("../../contracts.js");
      await waitForTransactionStatus(options.rpcUrl, options.afterTxHash);
    }
    const maxAttempts = options?.maxAttempts ?? 40;
    const intervalMs = options?.intervalMs ?? 1500;
    let state = options?.skipSync ? await this.current() : await this.sync();
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const verified = await this.verifyAgainstChain();
      const ok =
        options?.requireReceiving || options?.requireSpendable
          ? (!options?.requireReceiving || verified.receivingOk) &&
            (!options?.requireSpendable || verified.spendableOk)
          : verified.ok;
      if (ok) return state;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        state = options?.skipSync ? await this.current() : await this.sync();
      }
    }
    if (options?.allowRebuild !== false) {
      state = await this.rebuildFromEvents();
      const rebuilt = await this.verifyAgainstChain();
      const rebuiltOk =
        options?.requireReceiving || options?.requireSpendable
          ? (!options?.requireReceiving || rebuilt.receivingOk) &&
            (!options?.requireSpendable || rebuilt.spendableOk)
          : rebuilt.ok;
      if (rebuiltOk) return state;
    }
    throw new Error("Confidential balance sync timed out waiting for Stellar events.");
  }

  /**
   * Read-path reconciliation for the PASSIVE balance display.
   *
   * This is deliberately BOUNDED (a few seconds at most). It must never run the
   * long verification loop, because the UI keeps `loading=true` while it runs —
   * a long inline wait freezes the balance panel on "Checking…/Syncing…". The
   * long eventual-consistency wait belongs to the background resync timer
   * (AppContext) and to active operations (shield/merge/send via
   * `waitUntilVerified`), not to this read.
   *
   * Optimistic shield/merge state is preserved (never destroyed by a rebuild)
   * while Soroban event indexing catches up.
   */
  async reconcileForRead(_rpcUrl: string): Promise<{
    state: AccountState;
    verified: { ok: boolean; spendableOk: boolean; receivingOk: boolean };
  }> {
    const prior = await this.current();
    const hadOptimistic = (prior.optimisticTxHashes?.length ?? 0) > 0;

    let state = await this.sync();
    let verified = await this.verifyAgainstChain();
    if (verified.spendableOk) {
      await this.clearOptimisticMarkersIfVerified(verified);
      return { state, verified };
    }

    // Fresh device/account with no optimistic state: a single rebuild from the
    // event stream is safe and often resolves a cold cache immediately.
    if (!hadOptimistic) {
      const rebuilt = await this.rebuildFromEvents();
      const rebuiltVerified = await this.verifyAgainstChain();
      if (rebuiltVerified.spendableOk) {
        await this.clearOptimisticMarkersIfVerified(rebuiltVerified);
        return { state: rebuilt, verified: rebuiltVerified };
      }
      state = rebuilt;
      verified = rebuiltVerified;
    }

    // Short bounded wait for just-landed events (~4.5s worst case). Anything
    // longer is handled by the background resync timer so the UI never freezes.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await sleep(1500);
      state = hadOptimistic ? await this.current() : await this.sync();
      verified = await this.verifyAgainstChain();
      if (verified.spendableOk) {
        await this.clearOptimisticMarkersIfVerified(verified);
        return { state, verified };
      }
    }

    // Best effort: never lose optimistic shield/merge state on the way out.
    if (hadOptimistic) {
      await this.cfg.store.save(prior);
      state = prior;
    } else {
      state = await this.current();
    }
    return { state, verified };
  }

  private async clearOptimisticMarkersIfVerified(verified: {
    ok: boolean;
    spendableOk: boolean;
    receivingOk: boolean;
  }): Promise<void> {
    if (!verified.ok) return;
    const state = await this.current();
    if (!state.optimisticTxHashes?.length) return;
    state.optimisticTxHashes = undefined;
    await this.cfg.store.save(state);
  }
}
