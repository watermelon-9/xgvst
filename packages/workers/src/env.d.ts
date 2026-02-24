declare global {
  interface Env {
    QUOTE_KV: KVNamespace;
    QUOTE_DB: D1Database;
    QUOTE_DO: DurableObjectNamespace;
    QUOTE_API_TOKEN?: string;
    CORS_ALLOW_ORIGINS?: string;
    ALLTICK_TOKEN?: string;
    SINA_COOKIE?: string;
    EASTMONEY_TOKEN?: string;
    TENCENT_TOKEN?: string;
  }
}

export {};
