import { UnscreenError } from "./errors.js";
import type { FetchLike, UnscreenClientOptions } from "./types.js";

type RequestOptions = {
  method?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  headers?: HeadersInit;
};

export class ApiClient {
  readonly baseUrl: string;
  readonly fetch: FetchLike;
  readonly defaultTimeoutMs: number;
  private readonly apiKey: string;

  constructor(options: UnscreenClientOptions = {}) {
    this.apiKey = options.apiKey ?? readApiKeyFromEnv();
    this.baseUrl = trimTrailingSlash(options.baseUrl ?? "https://api.unscreen.ai");
    this.fetch = options.fetch ?? globalThis.fetch?.bind(globalThis);
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;

    if (!this.apiKey) {
      throw new UnscreenError("Missing Unscreen API key. Pass apiKey or set UNSCREEN_API_KEY.");
    }

    if (!this.fetch) {
      throw new UnscreenError("No fetch implementation is available. Pass fetch in the client options.");
    }
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers = new Headers(options.headers);
    headers.set("x-api-key", this.apiKey);

    let body: BodyInit | undefined;

    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }

    const response = await this.fetch(url, {
      method: options.method ?? "GET",
      headers,
      body,
    });

    return parseResponse<T>(response);
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(path, `${this.baseUrl}/`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const responseBody = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new UnscreenError(readErrorMessage(responseBody, response), {
      statusCode: response.status,
      requestId: response.headers.get("x-request-id") ?? undefined,
      response: responseBody,
    });
  }

  return responseBody as T;
}

function readErrorMessage(responseBody: unknown, response: Response): string {
  if (isObject(responseBody)) {
    const detail = responseBody.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item) => (isObject(item) && typeof item.msg === "string" ? item.msg : undefined))
        .filter(Boolean)
        .join("; ");
    }

    if (typeof responseBody.message === "string") {
      return responseBody.message;
    }
  }

  if (typeof responseBody === "string" && responseBody.length > 0) {
    return responseBody;
  }

  return `Unscreen API request failed: ${response.status} ${response.statusText}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function readApiKeyFromEnv(): string {
  if (typeof process === "undefined") {
    return "";
  }

  return process.env.UNSCREEN_API_KEY ?? "";
}
