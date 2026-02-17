# Apple Store Publication Checklist

Date: February 17, 2026
Project: Wearbloom (`com.axel.wearbloom`)

## Goal
Ship a build that can pass Apple App Review and function in production at review time.

## Execution Order

### 1. Restore public infrastructure endpoints (Blocker)
- [ ] Make `api.wearbloom.app` publicly resolvable and reachable over HTTPS.
- [ ] Make `wearbloom.app/privacy` publicly resolvable and reachable over HTTPS.
- [ ] Make `wearbloom.app/terms` publicly resolvable and reachable over HTTPS.
- [ ] Confirm legal pages match in-app and App Store Connect metadata.

Verification:
```bash
curl -I https://api.wearbloom.app/health
curl -I https://wearbloom.app/privacy
curl -I https://wearbloom.app/terms
```

### 2. Fix ATS policy for release (High risk)
- [x] Remove global ATS bypass (`NSAllowsArbitraryLoads=true`) for production iOS config.
- [x] Keep only narrowly scoped localhost exceptions if truly required for dev.
- [x] Re-introspect Expo config in production mode and verify ATS values.

Verification:
```bash
NODE_ENV=production pnpm --filter @acme/expo exec expo config --type introspect --json \
  | node -e 'const fs=require("node:fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const ats=data.ios?.infoPlist?.NSAppTransportSecurity;console.log("production ATS:", JSON.stringify(ats));if(ats?.NSAllowsArbitraryLoads===true || ats?.NSExceptionDomains?.localhost){process.exit(1)}'

NODE_ENV=development pnpm --filter @acme/expo exec expo config --type introspect --json \
  | node -e 'const fs=require("node:fs");const data=JSON.parse(fs.readFileSync(0,"utf8"));const ats=data.ios?.infoPlist?.NSAppTransportSecurity;console.log("development ATS:", JSON.stringify(ats));if(ats?.NSAllowsArbitraryLoads===true || ats?.NSExceptionDomains?.localhost?.NSExceptionAllowsInsecureHTTPLoads!==true){process.exit(1)}'
```

### 3. Ensure Apple IAP is fully configured end-to-end (Blocker)
- [ ] Set IAP server env vars: `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_PATH`.
- [ ] Set app identity vars: `APPLE_BUNDLE_ID` and `APPLE_APP_ID` (required for production verification).
- [ ] Restart server and confirm logs include `Apple IAP configured and ready` (and do not include `Apple IAP not configured`).
- [ ] Ensure `APPLE_IAP_KEY_PATH` points to an existing `.p8` key readable by the server process.
- [ ] Ensure `./certs` contains:
  - `AppleRootCA-G3.cer`
  - `AppleComputerRootCertificate.cer`
  - `AppleIncRootCertificate.cer`
- [ ] Confirm `POST /api/webhooks/apple` is reachable over HTTPS.
- [ ] Confirm webhook probe does not return `503` with `APPLE_IAP_NOT_CONFIGURED`.
- [ ] Complete one TestFlight/Sandbox purchase for `com.wearbloom.weekly`.
- [ ] Run restore flow from app and confirm subscription updates are processed.

Verification:
```bash
# 1) Files exist
test -f "$APPLE_IAP_KEY_PATH"
test -f ./certs/AppleRootCA-G3.cer
test -f ./certs/AppleComputerRootCertificate.cer
test -f ./certs/AppleIncRootCertificate.cer

# 2) Server reachable
curl -i https://api.wearbloom.app/health

# 3) Apple webhook route is live and IAP is configured
# Expected: HTTP 400 with {"error":"MISSING_SIGNED_PAYLOAD"}
# Not expected: HTTP 503 with {"error":"APPLE_IAP_NOT_CONFIGURED"}
curl -i -X POST https://api.wearbloom.app/api/webhooks/apple \
  -H "content-type: application/json" \
  -d '{}'
```
And in app logs/server logs:
- No `APPLE_IAP_NOT_CONFIGURED`
- Successful `verifyPurchase` and `restorePurchases`

### 4. Fix release quality gates (Build readiness)
- [x] Resolve Expo typed-route path errors from `pnpm typecheck`.
- [x] Resolve Expo lint failures from `pnpm lint`.
- [x] Keep tests passing after fixes.

Verification:
```bash
pnpm typecheck
pnpm lint
pnpm --filter @acme/expo test
```

### 5. App Store Connect submission readiness
- [ ] Confirm Privacy Nutrition Labels match real data collection/use.
- [ ] Fill Support URL and Marketing URL with live pages.
- [ ] Ensure subscription product (`com.wearbloom.weekly`) status is Ready to Submit/Approved in App Store Connect.
- [ ] Add review notes with test account and purchase restore instructions.
- [ ] Confirm account deletion path is described in review notes (Profile > Delete Account).

## Definition of Done
- [ ] All URLs resolve and return valid HTTPS responses.
- [x] ATS global bypass removed for production.
- [ ] IAP purchase + restore verified in TestFlight.
- [x] `pnpm typecheck` and `pnpm lint` pass.
- [x] Expo test suite passes.
- [ ] App Store Connect metadata and legal/privacy declarations are complete and consistent.
