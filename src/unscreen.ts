import { ApiClient } from "./client.js";
import { CreditsResource, JobsResource } from "./jobs.js";
import type {
  JobStartResponse,
  JobStatus,
  RemoveBackgroundOptions,
  UnscreenClientOptions,
} from "./types.js";

export class Unscreen {
  readonly jobs: JobsResource;
  readonly credits: CreditsResource;
  private readonly client: ApiClient;

  constructor(options: UnscreenClientOptions = {}) {
    this.client = new ApiClient(options);
    this.jobs = new JobsResource(this.client);
    this.credits = new CreditsResource(this.client);
  }

  async removeBackground(options: RemoveBackgroundOptions): Promise<JobStartResponse | JobStatus> {
    const started = await this.jobs.submit(options);
    const shouldWait = options.wait ?? !options.webhookUrl;

    if (!shouldWait) {
      return started;
    }

    const completed = await this.jobs.wait(started.jobId, options.waitOptions);

    if (options.output) {
      await this.jobs.download(completed, {
        asset: options.downloadAsset,
        path: options.output,
      });
    }

    return completed;
  }
}
