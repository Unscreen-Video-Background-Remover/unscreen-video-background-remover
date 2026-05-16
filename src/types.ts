export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type UnscreenClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetch?: FetchLike;
  defaultTimeoutMs?: number;
};

export type JobMode = "auto" | "human_only";

export type JobStatusName = "uploading" | "pending" | "processing" | "completed" | "failed";

export type VideoContentType =
  | "video/mp4"
  | "video/quicktime"
  | "video/webm"
  | "video/x-msvideo"
  | "video/x-matroska";

export type UnscreenInput = string | Blob | ArrayBuffer | Uint8Array;

export type CreateJobOptions = {
  mode?: JobMode;
  contentType?: VideoContentType;
  webhookUrl?: string;
};

export type SubmitJobOptions = CreateJobOptions & {
  input: UnscreenInput;
  mask?: UnscreenInput;
};

export type RemoveBackgroundOptions = SubmitJobOptions & {
  output?: string;
  wait?: boolean;
  waitOptions?: WaitOptions;
  downloadAsset?: DownloadAsset;
};

export type JobCreateResponse = {
  jobId: string;
  uploadUrl: string;
  maskUploadUrl: string | null;
  status: JobStatusName;
  mode: string;
  contentType: string;
};

export type JobStartResponse = {
  message: string;
  jobId: string;
  creditsRemaining: number;
};

export type JobStatus = {
  jobId: string;
  status: JobStatusName;
  userId: string;
  mode: string;
  previewImageUrl: string | null;
  maskUrl: string | null;
  outputVideoUrl: string | null;
  alphaVideoUrl: string | null;
  metadataUrl: string | null;
  errorMessage: string | null;
  processingTimeSeconds: number | null;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type JobListOptions = {
  limit?: number;
  offset?: number;
  status?: JobStatusName | string;
};

export type JobListResponse = {
  jobs: JobStatus[];
  total: number;
  limit: number;
  offset: number;
};

export type CreditsBalanceResponse = {
  userId: string;
  email: string | null;
  authMethod: string;
  credits: number;
  updatedAt: string;
};

export type WaitOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  signal?: AbortSignal;
};

export type DownloadAsset = "outputVideo" | "alphaVideo" | "mask" | "previewImage" | "metadata";

export type DownloadOptions = {
  asset?: DownloadAsset;
  path?: string;
};

export type WebhookEventType = "video.completed" | "video.failed";

export type WebhookEvent = {
  eventId: string;
  eventType: WebhookEventType;
  jobId: string;
  status: "completed" | "failed";
  resultUrl?: string;
};
