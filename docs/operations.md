# WearBloom operations

`server/compose.production.yml` is the Komodo/Caddy production template. Pin `WEARBLOOM_IMAGE` and `WEARBLOOM_WEB_IMAGE` to immutable registry tags or digests, deploy them to staging, run the smoke checks below, and promote those exact values to production. Retain the previous values for rollback.

The GitHub Actions workflow publishes `ghcr.io/axensrennes/wearbloom:server-<commit-sha>` and `ghcr.io/axensrennes/wearbloom:web-<commit-sha>` after validation. Production should use their resolved manifest digests. It must never deploy the mutable `latest` tag.

Required server settings are documented in `server/.env.example`. Production additionally requires Apple Sign in, App Store Server API, OpenAI, PostHog/Sentry, and App Attest values. `APP_ATTEST_REQUIRED=true` is forced in the production compose file.

Dokploy may store Apple and APNs `.p8` values either as escaped PEM text (`APPLE_PRIVATE_KEY` / `APNS_PRIVATE_KEY`) or base64 (`APPLE_PRIVATE_KEY_BASE64` / `APNS_PRIVATE_KEY_BASE64`). For APNs, map the sandbox or production key ID and value into the generic `APNS_KEY_ID` and `APNS_PRIVATE_KEY_BASE64` variables for that environment.

## Release order

1. Build the server and web images once after CI passes, then publish immutable tags.
2. Set the staging `WEARBLOOM_IMAGE` and `WEARBLOOM_WEB_IMAGE` values and deploy. The one-shot migration service runs versioned SQL before API and worker startup.
3. Verify `GET /health` reports `status=ok`, `api=true`, and `worker=true`; verify anonymous auth, an integrity-protected upload, render completion, authenticated result download, feedback, quota rejection, and account deletion.
4. Set production to the same image tag or digest and deploy. Watch error rate, render latency, queue age, provider cost, and failure-credit creation.
5. Roll back by restoring the previous compatible image value. Never reverse a destructive migration during an incident.

## Backups

Start the `backup` profile for daily custom-format PostgreSQL dumps retained for seven days on the VPS. Before public scale, also configure `.env.backup` with an encrypted restic repository and password, then start `offsite-backup`. It backs up both dumps and private images with daily, weekly, and monthly retention.

Test restoration monthly in an isolated staging database with `pg_restore`, then compare row counts and retrieve a sample private asset. A backup is not healthy until that restoration succeeds.

## External setup still required

Dokploy domains and TLS, Apple identifiers/keys, APNs, App Store products and server-notification endpoints, PostHog and Sentry projects, provider credentials, and App Store Connect metadata belong to the owner accounts and are intentionally not stored in this repository.
