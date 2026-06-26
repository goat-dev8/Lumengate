/**
 * Serializes WebAuthn ceremonies so only one passkey prompt runs at a time.
 * Concurrent startAuthentication calls abort each other ("abort signal" errors).
 */
let chain: Promise<unknown> = Promise.resolve();
let busyCount = 0;
const listeners = new Set<(busy: boolean) => void>();

function setBusy(next: boolean): void {
  if (next) {
    busyCount += 1;
  } else {
    busyCount = Math.max(0, busyCount - 1);
  }
  const busy = busyCount > 0;
  for (const listener of listeners) {
    listener(busy);
  }
}

export function subscribePasskeyBusy(listener: (busy: boolean) => void): () => void {
  listeners.add(listener);
  listener(busyCount > 0);
  return () => listeners.delete(listener);
}

export function isPasskeyCeremonyBusy(): boolean {
  return busyCount > 0;
}

export function runPasskeyCeremony<T>(_label: string, fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  });
  chain = run.catch(() => undefined);
  return run;
}
