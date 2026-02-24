type StorageBackend = 'kv' | 'd1';
type StorageStatus = 'ok' | 'error';

type StorageRecord = {
  at: string;
  scope: string;
  backend: StorageBackend;
  operation: string;
  status: StorageStatus;
  latencyMs: number;
  errorCode: string | null;
};

type StorageCounter = {
  count: number;
  errorCount: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
  lastLatencyMs: number;
  lastErrorCode: string | null;
  lastAt: string | null;
};

type StorageSnapshot = {
  scope: string;
  totals: {
    count: number;
    errorCount: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
  };
  operations: Array<{
    key: string;
    backend: StorageBackend;
    operation: string;
    count: number;
    errorCount: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
    lastLatencyMs: number;
    lastErrorCode: string | null;
    lastAt: string | null;
  }>;
  recent: StorageRecord[];
};

function nowIso() {
  return new Date().toISOString();
}

function resolveErrorCode(error: unknown): string {
  if (!error) return 'unknown';

  if (typeof error === 'string') return error.slice(0, 128);

  const candidate = error as { code?: unknown; errno?: unknown; name?: unknown; message?: unknown };
  const code = candidate.code ?? candidate.errno ?? candidate.name;

  if (typeof code === 'string' && code.trim()) return code.slice(0, 128);
  if (typeof code === 'number') return String(code);
  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message.slice(0, 128);
  }

  return 'unknown';
}

export class StorageTelemetry {
  private readonly byOperation = new Map<string, StorageCounter>();
  private readonly recent: StorageRecord[] = [];

  constructor(private readonly scope: string, private readonly recentLimit = 80) {}

  private makeKey(backend: StorageBackend, operation: string) {
    return `${backend}:${operation}`;
  }

  record(backend: StorageBackend, operation: string, latencyMs: number, error: unknown | null = null) {
    const key = this.makeKey(backend, operation);
    const safeLatency = Number.isFinite(latencyMs) ? Math.max(0, latencyMs) : 0;
    const at = nowIso();

    const current =
      this.byOperation.get(key) ??
      ({
        count: 0,
        errorCount: 0,
        totalLatencyMs: 0,
        maxLatencyMs: 0,
        lastLatencyMs: 0,
        lastErrorCode: null,
        lastAt: null
      } as StorageCounter);

    current.count += 1;
    current.totalLatencyMs += safeLatency;
    current.maxLatencyMs = Math.max(current.maxLatencyMs, safeLatency);
    current.lastLatencyMs = safeLatency;
    current.lastAt = at;

    const errorCode = error ? resolveErrorCode(error) : null;
    if (errorCode) {
      current.errorCount += 1;
      current.lastErrorCode = errorCode;
    }

    this.byOperation.set(key, current);

    const record: StorageRecord = {
      at,
      scope: this.scope,
      backend,
      operation,
      status: errorCode ? 'error' : 'ok',
      latencyMs: safeLatency,
      errorCode
    };

    this.recent.push(record);
    if (this.recent.length > this.recentLimit) {
      this.recent.splice(0, this.recent.length - this.recentLimit);
    }

    console.log(JSON.stringify({ tag: 'storage_observe', ...record }));
  }

  async observe<T>(backend: StorageBackend, operation: string, fn: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      const result = await fn();
      this.record(backend, operation, performance.now() - started, null);
      return result;
    } catch (error) {
      this.record(backend, operation, performance.now() - started, error);
      throw error;
    }
  }

  snapshot(): StorageSnapshot {
    const operations = [...this.byOperation.entries()].map(([key, counter]) => {
      const [backend, operation] = key.split(':', 2) as [StorageBackend, string];
      return {
        key,
        backend,
        operation,
        count: counter.count,
        errorCount: counter.errorCount,
        avgLatencyMs: counter.count ? counter.totalLatencyMs / counter.count : 0,
        maxLatencyMs: counter.maxLatencyMs,
        lastLatencyMs: counter.lastLatencyMs,
        lastErrorCode: counter.lastErrorCode,
        lastAt: counter.lastAt
      };
    });

    const totals = operations.reduce(
      (acc, item) => {
        acc.count += item.count;
        acc.errorCount += item.errorCount;
        acc.totalLatencyMs += item.avgLatencyMs * item.count;
        acc.maxLatencyMs = Math.max(acc.maxLatencyMs, item.maxLatencyMs);
        return acc;
      },
      { count: 0, errorCount: 0, totalLatencyMs: 0, maxLatencyMs: 0 }
    );

    return {
      scope: this.scope,
      totals: {
        count: totals.count,
        errorCount: totals.errorCount,
        avgLatencyMs: totals.count ? totals.totalLatencyMs / totals.count : 0,
        maxLatencyMs: totals.maxLatencyMs
      },
      operations: operations.sort((a, b) => a.key.localeCompare(b.key)),
      recent: [...this.recent]
    };
  }
}
