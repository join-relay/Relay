# Recall webhook: transcript and recording on the Meeting page

If the bot joins the call on Recall and you see the transcript and video on [recall.ai](https://recall.ai), but the **Relay Meeting page** does not show them, Relay is not receiving Recall’s events.

## What Relay needs

1. **Webhook URL**  
   In your Recall dashboard (or bot config), set the webhook URL to:
   ```text
   https://<your-relay-app-url>/api/webhooks/recall
   ```
   Example: `https://relay.example.com/api/webhooks/recall`  
   Recall must be able to reach this URL (no localhost unless you use a tunnel).

2. **Shared secret**  
   - In your Relay server env, set `RECALL_WEBHOOK_SECRET` to a random string.  
   - In Recall’s webhook settings, set the same value as the signing secret.  
   Relay uses it to verify that requests are from Recall.

After saving, new bot runs will send `bot.*` and `transcript.data` events to Relay. The Meeting page will then show status, live transcript, and (after the call ends) recording and summary.

## If it still doesn’t update

- Confirm the webhook URL is exactly `https://<your-domain>/api/webhooks/recall` (no trailing slash).
- Check server logs for `POST /api/webhooks/recall` and any 4xx/5xx responses.
- Ensure the same Relay deployment that created the bot is the one receiving the webhook (same `RELAY_PUBLIC_URL` / `NEXTAUTH_URL` and `RECALL_WEBHOOK_SECRET`).
