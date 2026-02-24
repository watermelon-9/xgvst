import { AllTickSource } from './AllTickSource';
import { EastMoneySource } from './EastMoneySource';
import { SinaSource } from './SinaSource';
import { TencentSource } from './TencentSource';
import type { QuoteSource, QuoteTick } from './QuoteSource';

export type SourceManagerStatus = {
  activeSource: string | null;
  priorityOrder: string[];
  subscribedSymbols: string[];
  failoverCount: number;
  reconnecting: boolean;
};

export class SourceManager {
  private readonly factories: Array<() => QuoteSource>;
  private readonly priorityOrder: string[];
  private readonly subscribed = new Set<string>();

  private currentIndex = 0;
  private source: QuoteSource | null = null;
  private failoverCount = 0;
  private reconnecting = false;
  private onTick: ((tick: QuoteTick) => void) | null = null;

  constructor() {
    this.factories = [
      () => new AllTickSource(),
      () => new SinaSource(),
      () => new EastMoneySource(),
      () => new TencentSource()
    ];
    this.priorityOrder = this.factories.map((f) => f().name);
  }

  async start(onTick: (tick: QuoteTick) => void) {
    this.onTick = onTick;
    await this.ensureSourceReady();
  }

  async setSymbols(symbols: string[]) {
    this.subscribed.clear();
    for (const symbol of symbols) this.subscribed.add(symbol);

    if (!this.source) {
      await this.ensureSourceReady();
      return;
    }

    await this.source.subscribe([...this.subscribed]);
  }

  async forceFailover(reason = 'manual') {
    await this.scheduleFailover(new Error(`Failover requested: ${reason}`));
  }

  status(): SourceManagerStatus {
    return {
      activeSource: this.source?.name ?? null,
      priorityOrder: this.priorityOrder,
      subscribedSymbols: [...this.subscribed],
      failoverCount: this.failoverCount,
      reconnecting: this.reconnecting
    };
  }

  private async ensureSourceReady() {
    if (this.source || this.reconnecting || !this.onTick) return;

    this.reconnecting = true;
    try {
      for (let attempts = 0; attempts < this.factories.length; attempts++) {
        const index = (this.currentIndex + attempts) % this.factories.length;
        const candidate = this.factories[index]();

        try {
          await candidate.connect({
            onTick: (tick) => this.onTick?.(tick),
            onError: (error) => {
              void this.scheduleFailover(error);
            }
          });

          this.source = candidate;
          this.currentIndex = index;
          await this.source.subscribe([...this.subscribed]);
          return;
        } catch {
          await candidate.close();
        }
      }
    } finally {
      this.reconnecting = false;
    }
  }

  private async scheduleFailover(error: Error) {
    if (this.reconnecting) return;

    this.failoverCount += 1;

    if (this.source) {
      await this.source.close();
      this.source = null;
    }

    this.currentIndex = (this.currentIndex + 1) % this.factories.length;

    this.reconnecting = true;
    setTimeout(() => {
      this.reconnecting = false;
      void this.ensureSourceReady().catch((err) => {
        console.error('SourceManager failover error', error.message, err?.message);
      });
    }, 1000);
  }
}
