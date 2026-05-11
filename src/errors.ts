export type UnscreenErrorOptions = {
  statusCode?: number;
  code?: string;
  requestId?: string;
  response?: unknown;
  cause?: unknown;
};

export class UnscreenError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly response?: unknown;

  constructor(message: string, options: UnscreenErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "UnscreenError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.requestId = options.requestId;
    this.response = options.response;
  }
}

export class UnscreenTimeoutError extends UnscreenError {
  constructor(message: string, options: UnscreenErrorOptions = {}) {
    super(message, options);
    this.name = "UnscreenTimeoutError";
  }
}
