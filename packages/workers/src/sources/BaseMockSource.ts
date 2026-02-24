import type { QuoteSource, QuoteSourceRuntime } from './QuoteSource';

const DEFAULT_SYMBOLS = new Map<string, number>([
  ['000001', 10.88],
  ['600519', 1628.3],
  ['300750', 182.45],
  ['000858', 145.2],
  ['601318', 42.6]
]);

export abstract class BaseMockSource implements QuoteSource {
  abstract readonly name: string;

  private runtime: QuoteSourceRuntime | null = null;
  private timer: number | null = null;
  private readonly subscribed = new Set<string>();

  async connect(runtime: QuoteSourceRuntime): Promise<void> {
    this.runtime = runtime;
    this.startStreaming();
  }

  async subscribe(symbols: string[]): Promise<void> {
    for (const symbol of symbols) this.subscribed.add(symbol);
  }

  async unsubscribe(symbols: string[]): Promise<void> {
    for (const symbol of symbols) this.subscribed.delete(symbol);
  }

  async close(): Promise<void> {
    this.subscribed.clear();
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.runtime = null;
  }

  private startStreaming() {
    if (this.timer !== null) return;

    this.timer = setInterval(() => {
      if (!this.runtime) return;

      for (const symbol of this.subscribed) {
        const base = DEFAULT_SYMBOLS.get(symbol) ?? 20;
        const noise = (Math.random() - 0.5) * 0.12;
        const price = Number((base + noise).toFixed(2));
        const changePct = Number((((price - base) / base) * 100).toFixed(2));

        this.runtime.onTick({
          symbol,
          price,
          changePct,
          ts: new Date().toISOString(),
          source: this.name
        });
      }
    }, 900) as unknown as number;
  }
}
