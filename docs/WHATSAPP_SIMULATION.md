# WhatsApp development simulation

This is a local SQLite simulation. It does not connect to a real WhatsApp account, charge Meta fees, or send network messages. The hosted Supabase preview does not yet implement this channel.

## Workflow
1. In AI assistant settings, choose automatic mode if desired. Mock remains the default; Gemini requires a fictional-workspace opt-in.
2. Open Integrations, acknowledge fictional data, connect the simulator and enable simulated automatic replies. Set attempt and simulated spending caps.
3. Submit an incoming message with a `synthetic-` customer identifier. The server builds a text-message envelope, signs the raw body, verifies its HMAC and resolves the tenant through its server-side account mapping.
4. New messages create or reuse a conversation, run dialect detection and the existing catalog/AI quota pipeline, then enqueue and simulate delivery. Latin Badini is interpreted as input; replies use Kurdish script.
5. Replay the exact webhook to exercise deduplication. Newly recorded simulation events retain their inbound timestamp, so a later API replay without a timestamp remains identical and cannot extend the service window. Historical events created before this timestamp migration still require their original explicit timestamp. Reusing its ID with different data is rejected. Use takeover to stop queued and new AI sends; human staff replies are separately attributed.
6. Delivery can be failed deliberately. Retry backoff is 1, 2, then 4 seconds; no more than three attempts are allowed. A successful resend is idempotent. Explicit simulated delivery/read receipts never regress a read state.

## Controls
- Owner-only configuration; tenant-scoped contacts, messages, events, outbox and attempt ledger.
- Customer free-form replies are blocked outside 24 hours of the last valid inbound timestamp. Old webhook replay cannot reopen the window. Future timestamps beyond one minute are rejected.
- Daily attempt and hypothetical spending limits are checked transactionally. AI replies additionally use the existing monthly/trial quota and provider caps. Simulated transport cost is not revenue or an actual invoice.
- Failed transport attempts count against limits. Unknown Gemini usage remains unknown.
- HMAC-SHA256 verification checks the exact body using timing-safe comparison. Account metadata cannot choose a different tenant after signature verification.
- Shared inbox human replies also enter the WhatsApp outgoing queue. Sending from the simulator remains explicit for human replies.
- Live `/api/webhooks/whatsapp` returns 503. `OfficialWhatsAppAdapter.send` always throws. No Meta key is requested or loaded.

## Verified and pending
Unit coverage includes signatures, challenge validation, tenant isolation, Latin Badini catalog replies, duplicate webhook IDs, human takeover, service-window enforcement, backoff, idempotent delivery, role restrictions and spending/attempt limits. Playwright verifies the UI workflow and mobile overflow checks.

The simulation currently handles one text message per envelope, with user-driven delivery receipts and retries. A production deployment still needs a durable asynchronous worker, crash recovery for in-flight incoming events, signed delivery-receipt ingestion, batched/media payload support, approved templates and template consent, encrypted credential lifecycle, account authorization and cloud persistence. Native speakers must assess dialect quality; heuristic/script tests alone do not establish fluency.

## Reference interfaces
- Meta-maintained webhook SDK reference: https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/
- Meta-maintained webhook callback reference: https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/webhookCallbackFunction/
- Current Meta documentation entry: https://developers.facebook.com/documentation/business-messaging/whatsapp/

Current Meta documentation requests returned HTTP 429 during this continuation. Live integration must revalidate current payload, permission, template and pricing rules before enabling sending. No live connection is claimed.
