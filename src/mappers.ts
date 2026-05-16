import type {
  JobCreateResponse,
  JobListResponse,
  JobStartResponse,
  JobStatus,
} from "./types.js";

type RawJobCreateResponse = {
  job_id: string;
  upload_url: string;
  mask_upload_url?: string | null;
  status: JobCreateResponse["status"];
  mode: string;
  content_type: string;
};

type RawJobStartResponse = {
  message: string;
  job_id: string;
  credits_remaining: number;
};

type RawJobStatus = {
  job_id: string;
  status: JobStatus["status"];
  user_id: string;
  mode: string;
  preview_image_url?: string | null;
  mask_url?: string | null;
  output_video_url?: string | null;
  alpha_video_url?: string | null;
  metadata_url?: string | null;
  error_message?: string | null;
  processing_time_seconds?: number | null;
  progress_percent?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};

type RawJobListResponse = {
  jobs: RawJobStatus[];
  total: number;
  limit: number;
  offset: number;
};

export function mapJobCreateResponse(raw: RawJobCreateResponse): JobCreateResponse {
  return {
    jobId: raw.job_id,
    uploadUrl: raw.upload_url,
    maskUploadUrl: raw.mask_upload_url ?? null,
    status: raw.status,
    mode: raw.mode,
    contentType: raw.content_type,
  };
}

export function mapJobStartResponse(raw: RawJobStartResponse): JobStartResponse {
  return {
    message: raw.message,
    jobId: raw.job_id,
    creditsRemaining: raw.credits_remaining,
  };
}

export function mapJobStatus(raw: RawJobStatus): JobStatus {
  return {
    jobId: raw.job_id,
    status: raw.status,
    userId: raw.user_id,
    mode: raw.mode,
    previewImageUrl: raw.preview_image_url ?? null,
    maskUrl: raw.mask_url ?? null,
    outputVideoUrl: raw.output_video_url ?? null,
    alphaVideoUrl: raw.alpha_video_url ?? null,
    metadataUrl: raw.metadata_url ?? null,
    errorMessage: raw.error_message ?? null,
    processingTimeSeconds: raw.processing_time_seconds ?? null,
    progressPercent: raw.progress_percent ?? 0,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    completedAt: raw.completed_at ?? null,
  };
}

export function mapJobListResponse(raw: RawJobListResponse): JobListResponse {
  return {
    jobs: raw.jobs.map(mapJobStatus),
    total: raw.total,
    limit: raw.limit,
    offset: raw.offset,
  };
}
