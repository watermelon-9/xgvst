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
    QUOTE_SNAPSHOT_TTL_SECONDS?: string;

    /**
     * Access/JWT guardrail for user-scoped APIs.
     * ACCESS_AUTH_REQUIRED=1(default): requests to protected APIs must carry valid identity.
     * ACCESS_AUTH_REQUIRED=0: local/dev bypass.
     */
    ACCESS_AUTH_REQUIRED?: string;

    /**
     * Optional trust mode for Cloudflare Access injected header:
     * cf-access-authenticated-user-email
     * Only enable when endpoint is behind Cloudflare Access.
     */
    ACCESS_TRUST_CF_HEADERS?: string;

    /** Optional local-simulation HS256 shared secret for JWT verify. */
    ACCESS_JWT_HS256_SECRET?: string;
    /** Optional strict issuer check. */
    ACCESS_JWT_ISS?: string;
    /** Optional strict audience check. */
    ACCESS_JWT_AUD?: string;

    /** Email auth runtime knobs (worker-side). */
    AUTH_PASSWORD_PEPPER?: string;
    AUTH_RESET_TOKEN_PEPPER?: string;
    AUTH_FORGOT_DEBUG_RETURN_TOKEN?: string;
    AUTH_PASSWORD_MIN_LENGTH?: string;
    AUTH_PBKDF2_ITERATIONS?: string;
    AUTH_ACCESS_TOKEN_TTL_SECONDS?: string;
    AUTH_RESET_TOKEN_TTL_SECONDS?: string;

    /** Source auth secrets: MUST be injected via `wrangler secret put <NAME>`. */
    ALLTICK_TOKEN?: string;
    SINA_COOKIE?: string;
    EASTMONEY_TOKEN?: string;
    TENCENT_TOKEN?: string;
  }
}

export {};
