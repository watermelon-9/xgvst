declare global {
  interface Env {
    API_URL: string;
    KV_NAMESPACE: string;
    D1_DATABASE_ID: string;
    QUOTE_KV: KVNamespace;
    QUOTE_DB: D1Database;
    QUOTE_DO: DurableObjectNamespace;
  }
}

export {};
