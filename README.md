# unscreen SDK

TypeScript SDK for the www.unscreen.io API.

Technical walkthrough for building a video background remover with Node.js: [Remove Video Background with JavaScript](https://www.unscreen.io/en/blog/remove-video-background-with-javascript).

![Uncreen Video Background Remover | www.unscreen.io ](https://raw.githubusercontent.com/Unscreen-Video-Background-Remover/unscreen-video-background-remover/main/assets/demo.gif)

Get your API key from <a href="https://www.unscreen.io/en/api#sdk" target="_blank" rel="noopener noreferrer">Unscreen API</a> first, then set it as `UNSCREEN_API_KEY`.

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

## License

Users and companies may use this package as-is, including in commercial applications, SaaS products, paid products, internal tools, and client projects.

You may not redistribute, rebrand, white-label, resell, sublicense, republish, fork-and-publish, or copy/extract any part of this software into another SDK, package, product, or service without prior written permission from support@rembg.com.

Unauthorized redistribution, rebranding, resale, sublicensing, republishing, or copying of this software is prohibited, is a material breach of the license, and may constitute copyright infringement.
