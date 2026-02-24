import type { QuoteSource, QuoteSourceRuntime } from './QuoteSource';

const DEFAULT_SYMBOLS = new Map<string, number>([
  ['000001', 10.88],
  ['600519', 1628.3],
  ['300750', 182.45],
  ['000858', 145.2],
  ['601318', 42.6]
]);

const STREAM_TICK_MS = 200;

export abstract class BaseMockSource implements QuoteSource {
  abstract readonly name: string;

  private runtime: QuoteSourceRuntime | null = null;
  private readonly subscribed = new Set<string>();
  private streamLoopRunning = false;

  async connect(runtime: QuoteSourceRuntime): Promise<void> {
    this.runtime = runtime;
    this.startStreaming();
    this.emitSnapshotTicks();
  }

  async subscribe(symbols: string[]): Promise<void> {
    let hasNewSymbol = false;
    for (const symbol of symbols) {
      if (!this.subscribed.has(symbol)) {
        this.subscribed.add(symbol);
        hasNewSymbol = true;
      }
    }

    // 切源后订阅完成立即有首 tick，避免等待下一周期
    if (hasNewSymbol) {
      this.emitSnapshotTicks();
    }
  }

  async unsubscribe(symbols: string[]): Promise<void> {
    for (const symbol of symbols) this.subscribed.delete(symbol);
  }

  async close(): Promise<void> {
    this.subscribed.clear();
    this.runtime = null;
    this.streamLoopRunning = false;
  }

  private async sleep(ms: number) {
    if (typeof scheduler !== 'undefined' && typeof scheduler.wait === 'function') {
      await scheduler.wait(ms);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildTick(symbol: string) {
    const base = DEFAULT_SYMBOLS.get(symbol) ?? 20;
    const noise = (Math.random() - 0.5) * 0.12;
    const price = Number((base + noise).toFixed(2));
    const changePct = Number((((price - base) / base) * 100).toFixed(2));

    return {
      symbol,
      price,
      changePct,
      ts: new Date().toISOString(),
      source: this.name
    };
  }

  private emitSnapshotTicks() {
    if (!this.runtime) return;

    for (const symbol of this.subscribed) {
      this.runtime.onTick(this.buildTick(symbol));
    }
  }

  private startStreaming() {
    if (this.streamLoopRunning) return;

    this.streamLoopRunning = true;
    void (async () => {
      let firstCycle = true;

      while (this.streamLoopRunning && this.runtime) {
        await this.sleep(firstCycle ? 0 : STREAM_TICK_MS);
        firstCycle = false;

        if (!this.runtime) break;
        this.emitSnapshotTicks();
      }

      this.streamLoopRunning = false;
    })();
  }
}
