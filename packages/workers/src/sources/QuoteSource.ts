export type QuoteTick = {
  symbol: string;
  price: number;
  changePct: number;
  ts: string;
  source: string;
};

export type QuoteSourceRuntime = {
  onTick: (tick: QuoteTick) => void;
  onError: (error: Error) => void;
};

export interface QuoteSource {
  readonly name: string;
  connect(runtime: QuoteSourceRuntime): Promise<void>;
  subscribe(symbols: string[]): Promise<void>;
  unsubscribe(symbols: string[]): Promise<void>;
  close(): Promise<void>;
}
