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
  readonly BATCH_DELAY_MS: number;
  readonly REQUEST_TIMEOUT_MS: number;
  readonly HEALTH_CHECK_INTERVAL_MS: number;

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

  // Concurrency settings
  GET_DEKA_ID_CONCURRENCY_LIMIT: parseInt(
    process.env.GET_DEKA_ID_CONCURRENCY_LIMIT || "5",
    10,
  ),
  DOWNLOAD_CONCURRENCY_LIMIT: parseInt(
    process.env.DOWNLOAD_CONCURRENCY_LIMIT || "5",
    10,
  ),
  RETRY_LIMIT: 3,
  INITIAL_RETRY_DELAY_MS: 1000,
  MAX_RETRY_DELAY_MS: 10000,

  // Timing settings
  BATCH_DELAY_MS: 2000,
  REQUEST_TIMEOUT_MS: 30000,
  HEALTH_CHECK_INTERVAL_MS: 30000,

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
