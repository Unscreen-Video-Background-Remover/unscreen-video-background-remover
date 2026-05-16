import type { FetchLike, UnscreenInput, VideoContentType } from "./types.js";
import { UnscreenError } from "./errors.js";

type PreparedInput = {
  body: BodyInit;
  contentType: VideoContentType;
};

type PreparedMaskInput = {
  body: BodyInit;
  contentType: "image/png";
};

const contentTypesByExtension: Record<string, VideoContentType> = {
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export async function prepareInput(
  input: UnscreenInput,
  fetchImpl: FetchLike,
  contentType?: VideoContentType,
): Promise<PreparedInput> {
  if (typeof input === "string") {
    if (isHttpUrl(input)) {
      return prepareRemoteUrl(input, fetchImpl, contentType);
    }

    return prepareLocalPath(input, contentType);
  }

  if (isBlob(input)) {
    return {
      body: input,
      contentType: normalizeContentType(input.type) ?? contentType ?? "video/mp4",
    };
  }

  return {
    body: input as BodyInit,
    contentType: contentType ?? "video/mp4",
  };
}

export async function prepareMaskInput(input: UnscreenInput, fetchImpl: FetchLike): Promise<PreparedMaskInput> {
  if (typeof input === "string") {
    if (isHttpUrl(input)) {
      return prepareRemoteMaskUrl(input, fetchImpl);
    }

    return prepareLocalMaskPath(input);
  }

  if (isBlob(input)) {
    const contentType = normalizeImageContentType(input.type);

    if (input.type && !contentType) {
      throw new UnscreenError("First-frame mask must be a PNG image.");
    }

    return {
      body: input,
      contentType: "image/png",
    };
  }

  return {
    body: input as BodyInit,
    contentType: "image/png",
  };
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

async function prepareRemoteUrl(
  url: string,
  fetchImpl: FetchLike,
  contentType?: VideoContentType,
): Promise<PreparedInput> {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new UnscreenError(`Failed to fetch input URL: ${response.status} ${response.statusText}`, {
      statusCode: response.status,
    });
  }

  const blob = await response.blob();
  const responseType = response.headers.get("content-type") ?? undefined;

  return {
    body: blob,
    contentType:
      normalizeContentType(responseType) ??
      contentType ??
      inferContentTypeFromPath(new URL(url).pathname) ??
      "video/mp4",
  };
}

async function prepareRemoteMaskUrl(url: string, fetchImpl: FetchLike): Promise<PreparedMaskInput> {
  const response = await fetchImpl(url);

  if (!response.ok) {
    throw new UnscreenError(`Failed to fetch mask URL: ${response.status} ${response.statusText}`, {
      statusCode: response.status,
    });
  }

  const responseType = response.headers.get("content-type") ?? undefined;
  const urlPathname = new URL(url).pathname;

  if (!normalizeImageContentType(responseType) && !hasPngExtension(urlPathname)) {
    throw new UnscreenError("First-frame mask must be a PNG image.");
  }

  return {
    body: await response.blob(),
    contentType: "image/png",
  };
}

async function prepareLocalPath(path: string, contentType?: VideoContentType): Promise<PreparedInput> {
  if (typeof process === "undefined" || !process.versions?.node) {
    throw new UnscreenError("Local file paths are only supported in Node.js.");
  }

  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(path);

  return {
    body: buffer as BodyInit,
    contentType: contentType ?? inferContentTypeFromPath(path) ?? "video/mp4",
  };
}

async function prepareLocalMaskPath(path: string): Promise<PreparedMaskInput> {
  if (typeof process === "undefined" || !process.versions?.node) {
    throw new UnscreenError("Local file paths are only supported in Node.js.");
  }

  if (!hasPngExtension(path)) {
    throw new UnscreenError("First-frame mask must be a PNG image.");
  }

  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(path);

  return {
    body: buffer as BodyInit,
    contentType: "image/png",
  };
}

function inferContentTypeFromPath(path: string): VideoContentType | undefined {
  const lower = path.toLowerCase();
  const match = Object.entries(contentTypesByExtension).find(([extension]) => lower.endsWith(extension));

  return match?.[1];
}

function normalizeContentType(value?: string): VideoContentType | undefined {
  if (!value) {
    return undefined;
  }

  const mediaType = value.split(";")[0]?.trim().toLowerCase();

  return Object.values(contentTypesByExtension).find((candidate) => candidate === mediaType);
}

function normalizeImageContentType(value?: string): "image/png" | undefined {
  if (!value) {
    return undefined;
  }

  return value.split(";")[0]?.trim().toLowerCase() === "image/png" ? "image/png" : undefined;
}

function hasPngExtension(path: string): boolean {
  return path.toLowerCase().endsWith(".png");
}
