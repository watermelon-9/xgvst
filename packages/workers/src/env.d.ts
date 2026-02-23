declare global {
  interface Env {
    QUOTE_KV: KVNamespace;
    QUOTE_DB: D1Database;
    QUOTE_DO: DurableObjectNamespace;
    QUOTE_API_TOKEN?: string;
  }
}

export {};
