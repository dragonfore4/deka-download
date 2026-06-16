export interface Config {
  // Base URLs
  readonly DEKA_BASE_URL: string;
  readonly DEKA_SEARCH_URL: string;
  readonly DEKA_PRINT_URL: string;
  readonly GOTENBERG_BASE_URL: string;
  readonly GOTENBERG_HTML_URL: string;

  // Concurrency settings
  readonly GET_DEKA_ID_CONCURRENCY_LIMIT: number;
  readonly DOWNLOAD_CONCURRENCY_LIMIT: number;
  readonly RETRY_LIMIT: number;
  readonly INITIAL_RETRY_DELAY_MS: number;
  readonly MAX_RETRY_DELAY_MS: number;

  // Timing settings
  readonly REQUEST_JITTER_MS: number;
  readonly REQUEST_TIMEOUT_MS: number;
  readonly HEALTH_CHECK_INTERVAL_MS: number;

  // How often to persist the checkpoint (every N completed downloads)
  readonly CHECKPOINT_EVERY: number;

  // File settings
  readonly DOWNLOAD_DIR: string;
  readonly CHECKPOINT_FILE: string;
  readonly LOG_FILE: string;

  // Feature flags
  readonly ENABLE_GOTENBERG: boolean;
  readonly ENABLE_CACHING: boolean;
  readonly ENABLE_RESUME: boolean;
  readonly ENABLE_HEALTH_CHECKS: boolean;
}

export const config: Config = {
  // Base URLs
  DEKA_BASE_URL: "https://deka.supremecourt.or.th",
  DEKA_SEARCH_URL: "https://deka.supremecourt.or.th/search",
  DEKA_PRINT_URL: "https://deka.supremecourt.or.th/printing/deka",
  GOTENBERG_BASE_URL: (
    process.env.GOTENBERG_URL || "http://127.0.0.1:3000"
  ).replace(/\/$/, ""),

  // Computed URLs
  get GOTENBERG_HTML_URL() {
    return `${this.GOTENBERG_BASE_URL}/forms/chromium/convert/html`;
  },

  // Concurrency settings (medium / safe defaults — overridable via env)
  GET_DEKA_ID_CONCURRENCY_LIMIT: parseInt(
    process.env.GET_DEKA_ID_CONCURRENCY_LIMIT || "8",
    10,
  ),
  DOWNLOAD_CONCURRENCY_LIMIT: parseInt(
    process.env.DOWNLOAD_CONCURRENCY_LIMIT || "8",
    10,
  ),
  RETRY_LIMIT: 3,
  INITIAL_RETRY_DELAY_MS: 800,
  MAX_RETRY_DELAY_MS: 8000,

  // Timing settings
  // Small random pre-request delay so the pool doesn't fire every worker at the
  // exact same instant (kinder to the server, lowers the chance of rate-limiting).
  REQUEST_JITTER_MS: parseInt(process.env.REQUEST_JITTER_MS || "300", 10),
  REQUEST_TIMEOUT_MS: 30000,
  HEALTH_CHECK_INTERVAL_MS: 30000,

  CHECKPOINT_EVERY: parseInt(process.env.CHECKPOINT_EVERY || "20", 10),

  // File settings
  DOWNLOAD_DIR: "downloads",
  CHECKPOINT_FILE: ".download_checkpoint.json",
  LOG_FILE: "deka_download.log",

  // Feature flags
  ENABLE_GOTENBERG: true,
  ENABLE_CACHING: true,
  ENABLE_RESUME: true,
  ENABLE_HEALTH_CHECKS: true,
};

export default config;
