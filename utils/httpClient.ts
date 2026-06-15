import { logger } from "./logger.js";

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
}

export class HttpClient {
  private static instance: HttpClient;
  private timeout: number;

  private constructor(timeout: number = 30000) {
    this.timeout = timeout;
  }

  public static getInstance(timeout?: number): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient(timeout);
    }
    return HttpClient.instance;
  }

  public async get<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: "GET" });
  }

  public async post<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: "POST" });
  }

  public async request<T>(
    url: string,
    options: RequestInit,
  ): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      let data: any;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else if (contentType.includes("text/")) {
        data = await response.text();
      } else if (contentType.includes("application/pdf")) {
        data = await response.arrayBuffer();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  public async requestWithRetry<T>(
    url: string,
    options: RequestInit,
    maxRetries: number = 3,
    initialDelay: number = 1000,
    maxDelay: number = 10000,
  ): Promise<HttpResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`HTTP request attempt ${attempt}/${maxRetries} to ${url}`);
        const result = await this.request<T>(url, options);
        if (attempt > 1) {
          logger.info(
            `Successfully recovered on attempt ${attempt} for ${url}`,
          );
        }
        return result;
      } catch (error: any) {
        lastError = error;
        logger.warn(`Attempt ${attempt} failed for ${url}: ${error.message}`);

        if (attempt < maxRetries) {
          // Calculate exponential backoff with jitter
          const delay = Math.min(
            initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
            maxDelay,
          );

          logger.info(
            `Waiting ${delay.toFixed(0)}ms before retry ${attempt + 1}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(`All ${maxRetries} attempts failed for ${url}`, lastError);
    throw new Error(
      `Failed after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`,
    );
  }
}

export const httpClient = HttpClient.getInstance();

export default httpClient;
