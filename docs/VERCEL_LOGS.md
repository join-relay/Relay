# Viewing Vercel logs and fixing “AI not responding”

## How to see runtime logs on Vercel

The build output you see in the dashboard is **build logs**. To see why the AI isn’t responding you need **runtime (function) logs**:

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your **Relay** project.
2. Go to the **Logs** tab (or **Deployments** → click a deployment → **Functions** / **Logs**).
3. Use **Runtime Logs** (or **Function Logs**) and filter by time or by path (e.g. `/api/briefing`).
4. Trigger the flow that uses the AI (e.g. open Briefing, or generate a draft in Actions), then refresh the logs.

You’ll see `console.error` and `console.warn` from your API routes and server code there. Look for lines like:

- `Briefing API error: ...`
- `OpenAI request failed (401): ...` or similar
- `OpenAI briefing prioritization failed: ...`

## Why the “AI model” might not be responding

### 1. **OPENAI_API_KEY not set on Vercel** (most common)

If `OPENAI_API_KEY` is missing in the Vercel project, the app uses **deterministic fallback** (no real AI). Briefing and drafts still work, but without model-generated text.

**Fix:** Project → **Settings** → **Environment Variables** → add `OPENAI_API_KEY` with your OpenAI API key, then **redeploy**.

### 2. **Wrong or unsupported model name**

The app uses the OpenAI **Responses API** and reads the model from env:

- `OPENAI_REASONING_MODEL` (default in code: `gpt-5-mini`)
- `OPENAI_HEAVY_REASONING_MODEL` (default: `gpt-5.4`)

If your OpenAI account or region doesn’t support these, the API can return an error. Check runtime logs for messages like `OpenAI request failed (400): ...` or `model not found`.

**Fix:** Set env to a model your account supports (e.g. `o1-mini`, `o1` if you use the Responses API). See [OpenAI API docs](https://platform.openai.com/docs) for current model IDs.

### 3. **Response format mismatch (usage goes up but you see fallback)**

If your **usage goes up** but the app still shows fallback text, the API is returning 200 but the response shape may not match what we parse. In Runtime Logs look for:

- `[OpenAI] no text output in response; top-level keys: ...`

The "top-level keys" line shows what the API actually returned. Share that with your dev or open an issue so the parser can be updated. The code already tries several shapes (`output`, `output_items`, `choices`); if your model returns a different structure, we need to add it.

### 4. **Timeouts or rate limits**

Vercel serverless functions have a timeout (e.g. 10s on Hobby). If the model is slow or you hit rate limits, the request can fail. Errors will appear in runtime logs.

**Fix:** Upgrade plan for longer timeouts if needed; fix rate limits or retry with backoff.

### 5. **Briefing / draft errors**

If the briefing API or the draft flow throws, the route logs `Briefing API error:` or the OpenAI service logs the failure. Use the **Logs** tab as above to see the exact error.

## Checklist

- [ ] **OPENAI_API_KEY** is set in Vercel (Settings → Environment Variables) for the right environment (Production/Preview).
- [ ] **Redeploy** after changing env vars (new deploys pick up new variables).
- [ ] **Runtime Logs** (not only build logs) are checked after reproducing the issue.
- [ ] Optional: set **OPENAI_REASONING_MODEL** / **OPENAI_HEAVY_REASONING_MODEL** if you need a specific model.
