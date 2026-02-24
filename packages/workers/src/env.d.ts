declare global {
  interface Env {
    QUOTE_KV: KVNamespace;
    QUOTE_DB: D1Database;
    QUOTE_DO: DurableObjectNamespace;

    /** Optional API token, inject via `wrangler secret put QUOTE_API_TOKEN`. */
    QUOTE_API_TOKEN?: string;

    /**
     * Optional comma-separated CORS allow list.
     * Example: "https://xgvst.com,https://xgvst.pages.dev"
     * Non-sensitive: can be configured in wrangler.toml [vars].
     */
    CORS_ALLOW_ORIGINS?: string;

    /** Source auth secrets: MUST be injected via `wrangler secret put <NAME>`. */
    ALLTICK_TOKEN?: string;
    SINA_COOKIE?: string;
    EASTMONEY_TOKEN?: string;
    TENCENT_TOKEN?: string;
  }
}

export {};
