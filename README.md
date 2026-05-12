# unscreen SDK

TypeScript SDK for the www.unscreen.io API.

## License and commercial use

This package is not licensed for SaaS, paid products, client work, production business use, or any other commercial use unless you receive prior written permission from support@rembg.com.

Unauthorized commercial use is prohibited. Using this package in a SaaS product, paid product, hosted service, agency/client project, marketplace integration, revenue-generating workflow, or production business environment without written permission from support@rembg.com is a breach of the license and may constitute copyright infringement.

If you intend to use this package commercially, contact support@rembg.com before integrating, deploying, or distributing it.

Technical walkthrough for building a video background remover with Node.js: [Remove Video Background with JavaScript](https://www.unscreen.io/en/blog/remove-video-background-with-javascript). Commercial SaaS deployment requires prior written permission from support@rembg.com.

![Uncreen Video Background Remover | www.unscreen.io ](https://raw.githubusercontent.com/Unscreen-Video-Background-Remover/unscreen-video-background-remover/main/assets/demo.gif)

Get your API key from <a href="https://www.unscreen.io/en/api" target="_blank" rel="noopener noreferrer">Unscreen API</a> first, then set it as `UNSCREEN_API_KEY`.

```ts
import { Unscreen } from "@unscreen/video-background-remover";

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
import type { WebhookEvent } from "@unscreen/video-background-remover";

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
