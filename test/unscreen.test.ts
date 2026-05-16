import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Unscreen, UnscreenError } from "../src/index.js";
import type { FetchLike, JobStatus, WebhookEvent } from "../src/index.js";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "unscreen-js-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("Unscreen", () => {
  it("submits a local file by creating, uploading, and starting a job", async () => {
    const inputPath = join(tempDir, "input.mp4");
    await writeFile(inputPath, Buffer.from("video"));

    const calls: FetchCall[] = [];
    const fetch = mockFetch(calls, [
      jsonResponse({
        job_id: "job_123",
        upload_url: "https://upload.example/job_123",
        status: "uploading",
        mode: "auto",
        content_type: "video/mp4",
      }, 201),
      new Response(null, { status: 200 }),
      jsonResponse({
        message: "started",
        job_id: "job_123",
        credits_remaining: 9,
      }, 202),
    ]);

    const unscreen = new Unscreen({ apiKey: "test-key", fetch });
    const job = await unscreen.jobs.submit({ input: inputPath, mode: "auto" });

    assert.equal(job.jobId, "job_123");
    assert.equal(job.creditsRemaining, 9);
    assert.equal(calls.length, 3);
    assert.equal(calls[0]?.url, "https://api.unscreen.ai/api/jobs");
    assert.equal(calls[0]?.init?.method, "POST");
    assert.deepEqual(JSON.parse(calls[0]?.init?.body as string), {
      mode: "auto",
      content_type: "video/mp4",
    });
    assert.equal(calls[1]?.url, "https://upload.example/job_123");
    assert.equal(calls[1]?.init?.method, "PUT");
    assert.equal(new Headers(calls[1]?.init?.headers).get("content-type"), "video/mp4");
    assert.equal(calls[2]?.url, "https://api.unscreen.ai/api/jobs/job_123/start");
    assert.equal(calls[2]?.init?.method, "POST");
  });

  it("uploads an optional first-frame mask for auto mode before starting the job", async () => {
    const inputPath = join(tempDir, "input.mp4");
    const maskPath = join(tempDir, "first-frame-mask.png");
    await writeFile(inputPath, Buffer.from("video"));
    await writeFile(maskPath, Buffer.from("mask"));

    const calls: FetchCall[] = [];
    const fetch = mockFetch(calls, [
      jsonResponse({
        job_id: "job_mask",
        upload_url: "https://upload.example/job_mask/video",
        mask_upload_url: "https://upload.example/job_mask/mask",
        status: "uploading",
        mode: "auto",
        content_type: "video/mp4",
      }, 201),
      new Response(null, { status: 200 }),
      new Response(null, { status: 200 }),
      jsonResponse({
        message: "started",
        job_id: "job_mask",
        credits_remaining: 9,
      }, 202),
    ]);

    const unscreen = new Unscreen({ apiKey: "test-key", fetch });
    const job = await unscreen.jobs.submit({ input: inputPath, mode: "auto", mask: maskPath });

    assert.equal(job.jobId, "job_mask");
    assert.equal(calls.length, 4);
    assert.equal(calls[1]?.url, "https://upload.example/job_mask/video");
    assert.equal(new Headers(calls[1]?.init?.headers).get("content-type"), "video/mp4");
    assert.equal(calls[2]?.url, "https://upload.example/job_mask/mask");
    assert.equal(calls[2]?.init?.method, "PUT");
    assert.equal(new Headers(calls[2]?.init?.headers).get("content-type"), "image/png");
    assert.equal(calls[3]?.url, "https://api.unscreen.ai/api/jobs/job_mask/start");
  });

  it("throws before creating a job when a mask is used with human_only mode", async () => {
    const inputPath = join(tempDir, "input.mp4");
    const maskPath = join(tempDir, "first-frame-mask.png");
    await writeFile(inputPath, Buffer.from("video"));
    await writeFile(maskPath, Buffer.from("mask"));

    const calls: FetchCall[] = [];
    const unscreen = new Unscreen({ apiKey: "test-key", fetch: mockFetch(calls, []) });

    await assert.rejects(
      () => unscreen.jobs.submit({ input: inputPath, mode: "human_only", mask: maskPath }),
      (error) => {
        assert.ok(error instanceof UnscreenError);
        assert.equal(error.code, "mask_not_supported_for_human_only");
        return true;
      },
    );
    assert.equal(calls.length, 0);
  });

  it("does not poll when removeBackground is called with a webhook URL", async () => {
    const inputPath = join(tempDir, "input.mov");
    await writeFile(inputPath, Buffer.from("video"));

    const calls: FetchCall[] = [];
    const fetch = mockFetch(calls, [
      jsonResponse({
        job_id: "job_webhook",
        upload_url: "https://upload.example/job_webhook",
        status: "uploading",
        mode: "human_only",
        content_type: "video/quicktime",
      }, 201),
      new Response(null, { status: 200 }),
      jsonResponse({
        message: "started",
        job_id: "job_webhook",
        credits_remaining: 4,
      }, 202),
    ]);

    const unscreen = new Unscreen({ apiKey: "test-key", fetch });
    const result = await unscreen.removeBackground({
      input: inputPath,
      mode: "human_only",
      webhookUrl: "https://example.com/webhooks/unscreen",
    });

    assert.equal(result.jobId, "job_webhook");
    assert.equal(calls.length, 3);
    assert.deepEqual(JSON.parse(calls[0]?.init?.body as string), {
      mode: "human_only",
      content_type: "video/quicktime",
      webhook_url: "https://example.com/webhooks/unscreen",
    });
  });

  it("polls until a job completes", async () => {
    const calls: FetchCall[] = [];
    const fetch = mockFetch(calls, [
      jsonResponse(rawJobStatus({ status: "processing", progress_percent: 40 })),
      jsonResponse(rawJobStatus({ status: "completed", progress_percent: 100 })),
    ]);

    const unscreen = new Unscreen({ apiKey: "test-key", fetch });
    const completed = await unscreen.jobs.wait("job_done", { intervalMs: 0 });

    assert.equal(completed.status, "completed");
    assert.equal(completed.progressPercent, 100);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.url, "https://api.unscreen.ai/api/jobs/job_done");
  });

  it("downloads the selected job asset to disk", async () => {
    const outputPath = join(tempDir, "output.mp4");
    const calls: FetchCall[] = [];
    const fetch = mockFetch(calls, [new Response(Buffer.from("result-video"), { status: 200 })]);
    const unscreen = new Unscreen({ apiKey: "test-key", fetch });

    const result = await unscreen.jobs.download(jobStatus({ outputVideoUrl: "https://download.example/output.mp4" }), {
      path: outputPath,
    });

    assert.equal(result, outputPath);
    assert.equal(await readFile(outputPath, "utf8"), "result-video");
    assert.equal(calls[0]?.url, "https://download.example/output.mp4");
  });

  it("throws UnscreenError for API failures", async () => {
    const calls: FetchCall[] = [];
    const fetch = mockFetch(calls, [
      jsonResponse({
        detail: [{ msg: "Invalid API key" }],
      }, 401),
    ]);

    const unscreen = new Unscreen({ apiKey: "bad-key", fetch });

    await assert.rejects(
      () => unscreen.jobs.get("job_123"),
      (error) => {
        assert.ok(error instanceof UnscreenError);
        assert.equal(error.statusCode, 401);
        assert.equal(error.message, "Invalid API key");
        return true;
      },
    );
  });

  it("types webhook runtime events as video events", () => {
    const completedEvent = {
      eventId: "evt_123",
      eventType: "video.completed",
      jobId: "job_123",
      status: "completed",
      resultUrl: "https://download.example/output.mp4",
    } satisfies WebhookEvent;

    const failedEvent = {
      eventId: "evt_124",
      eventType: "video.failed",
      jobId: "job_124",
      status: "failed",
    } satisfies WebhookEvent;

    assert.equal(completedEvent.eventType, "video.completed");
    assert.equal(failedEvent.eventType, "video.failed");
  });
});

function mockFetch(calls: FetchCall[], responses: Response[]): FetchLike {
  return async (input, init) => {
    calls.push({
      url: input.toString(),
      init,
    });

    const response = responses.shift();

    assert.ok(response, `Unexpected fetch call to ${input.toString()}`);

    return response;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function rawJobStatus(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    job_id: "job_done",
    status: "processing",
    user_id: "user_123",
    mode: "auto",
    preview_image_url: null,
    mask_url: null,
    output_video_url: "https://download.example/output.mp4",
    alpha_video_url: null,
    metadata_url: null,
    error_message: null,
    processing_time_seconds: null,
    progress_percent: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    completed_at: null,
    ...overrides,
  };
}

function jobStatus(overrides: Partial<JobStatus> = {}): JobStatus {
  return {
    jobId: "job_done",
    status: "completed",
    userId: "user_123",
    mode: "auto",
    previewImageUrl: null,
    maskUrl: null,
    outputVideoUrl: null,
    alphaVideoUrl: null,
    metadataUrl: null,
    errorMessage: null,
    processingTimeSeconds: 12,
    progressPercent: 100,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    completedAt: "2026-01-01T00:01:00Z",
    ...overrides,
  };
}
