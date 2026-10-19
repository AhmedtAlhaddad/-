# Cloudflare Workers staging runbook

## Safety boundary

`wrangler.jsonc` targets the isolated `alam-allayaqa-staging` Worker. Both
`workers.dev` and preview URLs are disabled, so the first deployment is not
publicly reachable. Do not add a route or enable either URL until Cloudflare
Access has been applied to this Worker.

## Required staging configuration

Set these as Worker secrets (never in `wrangler.jsonc` or source control):

- `ADMIN_LOGIN_EMAIL`
- `ADMIN_LOGIN_USERNAME`
- `ADMIN_SESSION_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_ADMIN_PHONE`
- `WHATSAPP_API_VERSION`
- `WHATSAPP_ORDER_TEMPLATE_LANGUAGE`
- `WHATSAPP_ORDER_TEMPLATE_NAME`
- `WHATSAPP_PHONE_NUMBER_ID`

Set these non-secret values separately for staging:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXTJS_ENV=staging`

The Supabase URL must identify a dedicated staging project. Do not reuse the
production database, even for checkout tests.

## Persistent cache prerequisite

The application uses `unstable_cache`, `revalidateTag`, and `revalidatePath`.
For a multi-isolate staging deployment, the dedicated
`alam-allayaqa-staging-cache` bucket is bound as `NEXT_INC_CACHE_R2_BUCKET`.
The OpenNext configuration also enables the durable tag cache and revalidation
queue (Durable Objects), which will be created by the first approved
deployment. Local preview does not prove durable cross-isolate revalidation.

## Access allowlist

After the first private deployment, enable Zero Trust and create a
Worker-specific Access application for `alam-allayaqa-staging`, protecting all
traffic. Use an Allow policy containing only the approved staging email
addresses (or the intended Cloudflare account members). Do not use an Allow
All policy and do not enable account-wide protection, which could affect the
unrelated Worker.

## Approved deployment sequence

1. Create and verify the isolated Supabase project, R2 bucket, and Access
   policy. These are remote, billable/account changes and require approval.
2. Add the secrets interactively with `npx wrangler secret put <NAME>` and
   configure the non-secret variables through the Worker environment.
3. Run `npm run lint`, the Node test suite, `npm run build:cf`, and
   `npx wrangler deploy --dry-run`.
4. Deploy the private Worker with `npx wrangler deploy`.
5. Confirm Access is active, then deliberately enable the desired protected
   Worker URL or protected custom staging hostname in a separate change.

## Rollback

Use `npx wrangler deployments list --name alam-allayaqa-staging` to select a
known-good Worker version, then run `npx wrangler rollback --name
alam-allayaqa-staging <version-id>`. Worker rollback does not roll back R2
objects, Durable Object state, or Supabase data; retain the staging resources
until the incident is resolved.
