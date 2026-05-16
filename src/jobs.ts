import { ApiClient } from "./client.js";
import { UnscreenError, UnscreenTimeoutError } from "./errors.js";
import { prepareInput, prepareMaskInput } from "./input.js";
import {
  mapJobCreateResponse,
  mapJobListResponse,
  mapJobStartResponse,
  mapJobStatus,
} from "./mappers.js";
import type {
  CreateJobOptions,
  CreditsBalanceResponse,
  DownloadAsset,
  DownloadOptions,
  JobCreateResponse,
  JobListOptions,
  JobListResponse,
  JobStartResponse,
  JobStatus,
  SubmitJobOptions,
  WaitOptions,
} from "./types.js";

type RawCreditsBalanceResponse = {
  user_id: string;
  email: string | null;
  auth_method: string;
  credits: number;
  updated_at: string;
};

const terminalStatuses = new Set(["completed", "failed"]);

export class JobsResource {
  constructor(private readonly client: ApiClient) {}

  async create(options: CreateJobOptions = {}): Promise<JobCreateResponse> {
    const response = await this.client.request<Parameters<typeof mapJobCreateResponse>[0]>("/api/jobs", {
      method: "POST",
      body: {
        mode: options.mode,
        content_type: options.contentType,
        webhook_url: options.webhookUrl,
      },
    });

    return mapJobCreateResponse(response);
  }

  async upload(job: JobCreateResponse, input: SubmitJobOptions["input"]): Promise<void> {
    const prepared = await prepareInput(input, this.client.fetch, job.contentType as SubmitJobOptions["contentType"]);

    await this.uploadPrepared(job.uploadUrl, prepared.body, prepared.contentType, "video");
  }

  async uploadMask(job: JobCreateResponse, mask: NonNullable<SubmitJobOptions["mask"]>): Promise<void> {
    assertMaskIsAllowed(job.mode);

    if (!job.maskUploadUrl) {
      throw new UnscreenError("The API did not return a first-frame mask upload URL.", {
        code: "mask_upload_url_missing",
      });
    }

    const prepared = await prepareMaskInput(mask, this.client.fetch);

    await this.uploadPrepared(job.maskUploadUrl, prepared.body, prepared.contentType, "first-frame mask");
  }

  private async uploadPrepared(
    uploadUrl: string,
    body: BodyInit,
    contentType: string,
    label: string,
  ): Promise<void> {
    const response = await this.client.fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": contentType,
      },
      body,
    });

    if (!response.ok) {
      throw new UnscreenError(`Failed to upload ${label}: ${response.status} ${response.statusText}`, {
        statusCode: response.status,
      });
    }
  }

  async start(jobId: string): Promise<JobStartResponse> {
    const response = await this.client.request<Parameters<typeof mapJobStartResponse>[0]>(
      `/api/jobs/${encodeURIComponent(jobId)}/start`,
      {
        method: "POST",
      },
    );

    return mapJobStartResponse(response);
  }

  async submit(options: SubmitJobOptions): Promise<JobStartResponse> {
    if (options.mask !== undefined) {
      assertMaskIsAllowed(options.mode ?? "auto");
    }

    const prepared = await prepareInput(options.input, this.client.fetch, options.contentType);
    const job = await this.create({
      mode: options.mode,
      contentType: prepared.contentType,
      webhookUrl: options.webhookUrl,
    });

    await this.uploadPrepared(job.uploadUrl, prepared.body, prepared.contentType, "video");

    if (options.mask !== undefined) {
      await this.uploadMask(job, options.mask);
    }

    return this.start(job.jobId);
  }

  async get(jobId: string): Promise<JobStatus> {
    const response = await this.client.request<Parameters<typeof mapJobStatus>[0]>(
      `/api/jobs/${encodeURIComponent(jobId)}`,
    );

    return mapJobStatus(response);
  }

  async list(options: JobListOptions = {}): Promise<JobListResponse> {
    const response = await this.client.request<Parameters<typeof mapJobListResponse>[0]>("/api/jobs", {
      query: {
        limit: options.limit,
        offset: options.offset,
        status: options.status,
      },
    });

    return mapJobListResponse(response);
  }

  async wait(jobId: string, options: WaitOptions = {}): Promise<JobStatus> {
    const startedAt = Date.now();
    const timeoutMs = options.timeoutMs ?? 10 * 60_000;
    const intervalMs = options.intervalMs ?? 2_000;

    while (true) {
      throwIfAborted(options.signal);

      const job = await this.get(jobId);

      if (terminalStatuses.has(job.status)) {
        if (job.status === "failed") {
          throw new UnscreenError(job.errorMessage ?? `Unscreen job failed: ${job.jobId}`, {
            code: "job_failed",
            response: job,
          });
        }

        return job;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new UnscreenTimeoutError(`Timed out waiting for Unscreen job: ${jobId}`, {
          code: "job_wait_timeout",
        });
      }

      await sleep(intervalMs, options.signal);
    }
  }

  async download(jobOrStatus: string | JobStatus, options: DownloadOptions = {}): Promise<ArrayBuffer | string> {
    const job = typeof jobOrStatus === "string" ? await this.get(jobOrStatus) : jobOrStatus;
    const asset = options.asset ?? "outputVideo";
    const url = getAssetUrl(job, asset);

    if (!url) {
      throw new UnscreenError(`Job ${job.jobId} does not have a ${asset} URL.`, {
        code: "asset_not_available",
        response: job,
      });
    }

    const response = await this.client.fetch(url);

    if (!response.ok) {
      throw new UnscreenError(`Failed to download ${asset}: ${response.status} ${response.statusText}`, {
        statusCode: response.status,
      });
    }

    const data = await response.arrayBuffer();

    if (!options.path) {
      return data;
    }

    const { writeFile } = await import("node:fs/promises");
    await writeFile(options.path, Buffer.from(data));

    return options.path;
  }
}

export class CreditsResource {
  constructor(private readonly client: ApiClient) {}

  async getBalance(): Promise<CreditsBalanceResponse> {
    const response = await this.client.request<RawCreditsBalanceResponse>("/api/jobs/credits/balance");

    return {
      userId: response.user_id,
      email: response.email,
      authMethod: response.auth_method,
      credits: response.credits,
      updatedAt: response.updated_at,
    };
  }
}

function getAssetUrl(job: JobStatus, asset: DownloadAsset): string | null {
  switch (asset) {
    case "alphaVideo":
      return job.alphaVideoUrl;
    case "mask":
      return job.maskUrl;
    case "metadata":
      return job.metadataUrl;
    case "outputVideo":
      return job.outputVideoUrl;
    case "previewImage":
      return job.previewImageUrl;
  }
}

function assertMaskIsAllowed(mode?: string): void {
  if (mode === "human_only") {
    throw new UnscreenError("First-frame masks are only supported in auto mode. Remove mask or use mode: \"auto\".", {
      code: "mask_not_supported_for_human_only",
    });
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new UnscreenError("Operation aborted.", { code: "aborted" }));
      },
      { once: true },
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new UnscreenError("Operation aborted.", { code: "aborted" });
  }
}
