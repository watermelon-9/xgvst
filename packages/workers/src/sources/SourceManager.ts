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
  debugForcedSource: string | null;
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
  private debugForcedSource: string | null = null;

  constructor() {
    this.factories = [
      () => new AllTickSource(),
      () => new SinaSource(),
      () => new EastMoneySource(),
      () => new TencentSource()
    ];
    this.priorityOrder = this.factories.map((f) => f().name);
  }

  getAvailableSources(): string[] {
    return [...this.priorityOrder];
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

  async debugSetSource(sourceName: string | null) {
    if (sourceName !== null && !this.priorityOrder.includes(sourceName)) {
      throw new Error(`Unknown source: ${sourceName}`);
    }

    this.debugForcedSource = sourceName;

    if (sourceName !== null) {
      this.currentIndex = this.priorityOrder.indexOf(sourceName);
    }

    await this.reconnectNow();
    return this.status();
  }

  status(): SourceManagerStatus {
    return {
      activeSource: this.source?.name ?? null,
      priorityOrder: this.priorityOrder,
      subscribedSymbols: [...this.subscribed],
      failoverCount: this.failoverCount,
      reconnecting: this.reconnecting,
      debugForcedSource: this.debugForcedSource
    };
  }

  private async reconnectNow() {
    if (this.source) {
      await this.source.close();
      this.source = null;
    }

    this.reconnecting = false;
    await this.ensureSourceReady();
  }

  private candidateIndices(): number[] {
    if (this.debugForcedSource) {
      const forced = this.priorityOrder.indexOf(this.debugForcedSource);
      return forced >= 0 ? [forced] : [];
    }

    const result: number[] = [];
    for (let attempts = 0; attempts < this.factories.length; attempts++) {
      result.push((this.currentIndex + attempts) % this.factories.length);
    }
    return result;
  }

  private async ensureSourceReady() {
    if (this.source || this.reconnecting || !this.onTick) return;

    this.reconnecting = true;
    try {
      for (const index of this.candidateIndices()) {
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

    if (!this.debugForcedSource) {
      this.currentIndex = (this.currentIndex + 1) % this.factories.length;
    }

    // DoD5: 避免固定 1s 等待；让切换在下一微任务立即执行。
    this.reconnecting = true;
    queueMicrotask(() => {
      this.reconnecting = false;
      void this.ensureSourceReady().catch((err) => {
        console.error('SourceManager failover error', error.message, err?.message);
      });
    });
  }
}
