export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function retryDelay(attempt: number, options?: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs' | 'jitterMs'>): number {
  const baseDelayMs = options?.baseDelayMs ?? 800;
  const maxDelayMs = options?.maxDelayMs ?? 8_000;
  const jitterMs = options?.jitterMs ?? 250;
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
  return exponential + jitter;
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const attempts = options?.attempts ?? 5;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = options?.shouldRetry?.(error, attempt) ?? true;
      if (!retryable || attempt >= attempts) break;
      const delayMs = retryDelay(attempt, options);
      options?.onRetry?.(attempt, delayMs, error);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
