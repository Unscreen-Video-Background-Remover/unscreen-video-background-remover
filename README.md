# unscreen.js

TypeScript SDK for the Unscreen.io API.

```ts
import { Unscreen } from "unscreen.js";

const unscreen = new Unscreen({
  apiKey: process.env.UNSCREEN_API_KEY,
});

const job = await unscreen.jobs.submit({
  input: "./input.mp4",
  mode: "auto",
});

const done = await unscreen.jobs.wait(job.jobId);

await unscreen.jobs.download(done, {
  asset: "outputVideo",
  path: "./output.mp4",
});
```

Webhook flow:

```ts
await unscreen.jobs.submit({
  input: "./input.mp4",
  webhookUrl: "https://example.com/webhooks/unscreen",
});

// No polling is needed here. Your webhook endpoint receives completion.
```

Webhook event names are `video.completed` and `video.failed`:

```ts
import type { WebhookEvent } from "unscreen.js";

export async function handleUnscreenWebhook(event: WebhookEvent) {
  if (event.eventType === "video.completed") {
    console.log(event.jobId, event.resultUrl);
  }

  if (event.eventType === "video.failed") {
    console.log(event.jobId);
  }
}
```

Convenience flow:

```ts
await unscreen.removeBackground({
  input: "./input.mp4",
  output: "./output.mp4",
});
```

If `webhookUrl` is provided, `removeBackground` submits and starts the job without waiting unless `wait: true` is explicitly passed.
