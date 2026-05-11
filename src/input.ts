import type { FetchLike, UnscreenInput, VideoContentType } from "./types.js";
import { UnscreenError } from "./errors.js";

type PreparedInput = {
  body: BodyInit;
  contentType: VideoContentType;
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
