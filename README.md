# cloudflare-edge-tts

Minimal Cloudflare Worker that exposes Microsoft Edge Text-to-Speech over HTTP using `edge-tts-universal@1.4.0`.

## Endpoints

### `GET /health`

Returns a lightweight health response:

```json
{
  "ok": true
}
```

### `GET /voices`

Returns the available Edge TTS voices:

```json
{
  "voices": [
    {
      "Name": "Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)",
      "ShortName": "zh-CN-XiaoxiaoNeural"
    }
  ]
}
```

The `voices` payload includes `ShortName` values. This Worker's default voice uses the more specific provider voice string `zh-CN-Xiaoxiao:DragonHDFlashLatestNeural`, so callers may choose to pass either an upstream-compatible provider voice string or a discovered voice value that the upstream library accepts.

### `POST /tts`

Synthesizes speech and streams `audio/mpeg` back to the client.

Request body:

```json
{
  "text": "你好，世界",
  "voice": "zh-CN-XiaoxiaoNeural"
}
```

`voice` is optional. When omitted, the Worker uses `zh-CN-Xiaoxiao:DragonHDFlashLatestNeural`.

Validation and error behavior:

- Requires `Content-Type: application/json`
- Requires a non-empty string `text`
- Returns `502` when the upstream TTS request fails before the audio response starts, for example before or while priming the first chunk

## Setup

Install dependencies:

```bash
npm install
```

Generate Worker environment types:

```bash
npm run cf-typegen
```

## Development

Remote runtime development with Cloudflare:

```bash
npm run dev
```

Local runtime development:

```bash
npm run dev:local
```

## Testing

Run the test suite:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```

## Remote Smoke Test

Real-runtime validation uses `wrangler dev --remote`.

Confirm the authenticated Cloudflare account:

```bash
npx wrangler whoami
```

Start the remote dev server on localhost:

```bash
npm run dev
```

Use the actual URL printed by Wrangler if it differs from `http://127.0.0.1:8787`.

In another terminal, run the smoke test:

```bash
curl -i --max-time 10 http://127.0.0.1:8787/health
curl -sS --max-time 10 \
  -D /tmp/cloudflare-edge-tts-voices.headers \
  http://127.0.0.1:8787/voices \
  --output /tmp/cloudflare-edge-tts-voices.json && \
  awk 'NR==1 { print $2 }' /tmp/cloudflare-edge-tts-voices.headers
curl -sS --max-time 10 \
  -D /tmp/cloudflare-edge-tts-tts.headers \
  -H 'Content-Type: application/json' \
  http://127.0.0.1:8787/tts \
  --data '{"text":"你好，世界"}' \
  --output /tmp/cloudflare-edge-tts-tts.body && \
  awk 'NR==1 { print $2 }' /tmp/cloudflare-edge-tts-tts.headers && \
  file /tmp/cloudflare-edge-tts-tts.body
```

Expected checks:

- `/health` should return `200`
- `/voices` should write headers to `/tmp/cloudflare-edge-tts-voices.headers`, write JSON to `/tmp/cloudflare-edge-tts-voices.json`, and report an HTTP `200` status
- The voices response should contain one or more `ShortName` entries
- `/tts` should write headers to `/tmp/cloudflare-edge-tts-tts.headers`, write the response body to `/tmp/cloudflare-edge-tts-tts.body`, and report the HTTP status
- A successful `/tts` call should be `200` with `audio/mpeg`; a failure should remain inspectable as headers plus a non-audio body, such as a JSON error response

## Deployment

Deploy the Worker:

```bash
npm run deploy
```

## Dependency Note

This project depends on `edge-tts-universal@1.4.0`, which is licensed under the AGPL. Review that license before using this Worker in environments with distribution or network-service obligations.

## Notes

Observed remote validation result on 2026-04-10 with `wrangler 4.81.1`:

- `npx wrangler whoami` succeeded
- The authenticated Cloudflare account context used for the run was `1f1d1678a2413a54c944b3081bab5c84`
- `npm run dev` started `wrangler dev --remote`, uploaded a remote preview, and reported `Ready on http://localhost:8787`
- `curl -i --max-time 10 http://127.0.0.1:8787/health` failed with `curl: (28) Operation timed out after 10005 milliseconds with 0 bytes received`
- `curl -sS --max-time 10 http://127.0.0.1:8787/voices --output /tmp/cloudflare-edge-tts-voices.json` failed with `curl: (28) Operation timed out after 10004 milliseconds with 0 bytes received`, so no `ShortName` entries could be confirmed from the remote run
- `curl -sS --max-time 10 -X POST http://127.0.0.1:8787/tts -H 'Content-Type: application/json' --data '{"text":"你好，世界"}' --output /tmp/cloudflare-edge-tts.mp3` failed with `curl: (28) Operation timed out after 10004 milliseconds with 0 bytes received`, and no non-zero MP3 was produced

This means the real validation via `wrangler dev --remote` did not succeed in this environment. The localhost remote-preview proxy accepted TCP connections but did not return any HTTP response bytes for `/health`, `/voices`, or `/tts`, so the Worker could not be verified successfully against the real Cloudflare runtime from this run.
