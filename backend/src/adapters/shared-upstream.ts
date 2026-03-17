export type TimedCache<T> = {
  expiresAt: number;
  value: T;
};

export function createTimedCache<T>(value: T, ttlMs: number, now = Date.now()): TimedCache<T> {
  return {
    expiresAt: now + ttlMs,
    value,
  };
}

export function getFreshCacheValue<T>(cache: TimedCache<T> | null, now = Date.now()): T | null {
  if (!cache || cache.expiresAt <= now) {
    return null;
  }

  return cache.value;
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs = 8_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Upstream request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
