---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-02-08.md'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 1
  projectDocs: 0
classification:
  projectType: 'mobile_app'
  domain: 'fashion_lifestyle_ai'
  complexity: 'medium'
  projectContext: 'greenfield'
workflowType: 'prd'
---

# Product Requirements Document - Wearbloom

**Author:** Axel
**Date:** 2026-02-09

## Executive Summary

**Wearbloom** is an AI-powered mobile app that lets users photograph their own clothes and virtually try them on using AI rendering. Unlike existing virtual try-on solutions focused on e-commerce (trying brand items before purchase), Wearbloom reverses the paradigm: users try on what they already own to decide what to wear each morning.

**Target users:** Fashion-conscious women aged 18-35 who struggle with the daily "what do I wear?" decision.

**Core value proposition:** Visualize how a garment looks on your body before getting dressed. No more standing in front of the closet guessing.

**Business model:** Freemium — wardrobe storage is free, AI try-on renders are the paid product. 3 free credits (trial), then weekly subscription (~4.99€/week). This aligns technical costs (GPU inference) directly with revenue.

**Positioning:** Anti-fast-fashion — "use better what you already have." A fashion app that discourages consumption.

**Tech stack:** React Native (Expo) for iOS-first development (no Mac required), personal VPS with Dokploy for backend, external AI inference service (Nano Banana Pro).

**MVP validation hypothesis:** Will people pay to see an AI render of themselves wearing their own clothes?

## Success Criteria

### User Success

- **First wow moment under 60 seconds**: From app download to first try-on result using stock photos. Own photo path available but not required for initial experience.
- **Daily morning ritual**: The app becomes the reflexive tool for deciding what to wear. Success = daily opens before getting dressed.
- **Wardrobe lock-in**: Growing wardrobe size per user over time. More garments = more indispensable.
- **Acceptable render quality**: Not photo-realistic at MVP, but accurate enough to judge if a garment works on you.

### Business Success

- **First paying subscriber within 1 week** of launch — validation milestone.
- **Trial-to-paid conversion > 10%** — primary PMF signal.
- **PMF indicators**: Users return without push notifications, organic word-of-mouth, server scaling needed.
- **Revenue model**: Weekly subscription (~4.99€/week). Apple takes ~30% → net ~3.50€/week per subscriber.

### Technical Success

- **AI inference time**: 5-10 seconds per render via external inference service (Nano Banana Pro).
- **Cost alignment**: Freemium model aligns inference cost with revenue. Non-paying users cost virtually nothing to serve.
- **Limited category launch**: Only clothing categories where the model performs well. New categories added as quality improves.

### Measurable Outcomes

| Metric | Target | Timeframe |
|--------|--------|-----------|
| Time to first try-on (stock photos) | < 60 seconds | MVP launch |
| AI inference time | 5-10 seconds | MVP launch |
| First paying subscriber | 1 | Week 1 post-launch |
| Trial-to-paid conversion | > 10% | Month 3 |
| Daily active usage (morning opens) | Tracked | Month 1+ |
| Wardrobe size per active user | Growing trend | Month 2+ |

## User Journeys

### Journey 1: Estelle — The Morning Ritual (Daily Active User)

Estelle, 22. Every morning it's the same mental block in front of her closet. She has clothes she likes, but never knows how to put them together. She falls back on the same "safe" combinations and feels uninspired.

With Wearbloom, she opens the app while doing her makeup. She scrolls her wardrobe, picks a garment, and sees the AI render on her body within seconds. "Oh yeah, that works." She gets dressed with confidence. Time added to her routine: zero — she was already thinking about it, now she has a tool to visualize it.

**Capabilities revealed:**
- Quick wardrobe access (< 2 taps)
- Single-garment AI try-on render
- App must be faster than standing in front of the closet

### Journey 2: Estelle — First Time (Onboarding)

Estelle sees a TikTok from a creator showing the app. She downloads it. The app shows example photos at each step and lets her use them to try the flow instantly. Within 30 seconds she sees an AI render. "Wow, that's me." Convinced, she starts photographing her own clothes. The trial gives 3 free renders. By the 3rd, she subscribes.

**Capabilities revealed:**
- 3-step onboarding with example photos at each step
- Stock/example photos for immediate wow moment without own photos
- Smooth transition to own garments post-onboarding
- Natural paywall after 3 credits
- Adding garments: simple photo → categorization

### Journey 3: Axel — Solo Admin (Operations)

Axel monitors his VPS via Dokploy. He checks inference costs, daily generation count, and conversion rate. A spike — 50 renders in an hour. Good sign. He reviews quality feedback: 3 "bad render" reports on wide-leg pants. He notes that category needs improvement and adjusts available categories.

**Capabilities revealed:**
- Monitoring via logs (no admin dashboard at MVP)
- Key metrics: generations/day, conversion, quality feedback
- Clothing category management (enable/disable)

### Journey 4: The Affiliate Creator (Acquisition — Post-MVP)

A micro-influencer receives an affiliate link. She tests the app, films a TikTok. Her audience clicks, downloads, tries it. Each conversion earns her a commission.

**Capabilities revealed:**
- Affiliate link system with tracking (Post-MVP)
- Content export with watermark (Post-MVP)
- Onboarding optimized for external traffic

### Journey Requirements Summary

| Journey | Key Capabilities |
|---------|-----------------|
| Morning Ritual | Quick wardrobe access, single-garment AI render, performance |
| Onboarding | 3-step flow, example photos, garment upload, trial paywall |
| Admin/Ops | Logs monitoring, quality feedback review, category management |
| Affiliate Creator | Tracking links, content export (Post-MVP) |

## Domain-Specific Requirements

### App Store Compliance

- Apple In-App Purchase required for weekly subscription (~4.99€, net ~3.50€ after Apple's ~30%).
- Trial mechanism must comply with Apple's auto-renewable subscription guidelines.
- App Review guidelines compliance: content policies, privacy, subscription transparency.
- Plan for Apple review process timeline in launch planning.

### Privacy & Data Handling

- First-launch consent screen (Apple requirement): brief data usage explanation + privacy policy link + "Accept" button. One time only.
- Privacy policy page (Apple + GDPR requirement): data collected, usage, storage location.
- Right to deletion via account settings (Apple + GDPR requirement).
- HTTPS for all data transfers. No publicly accessible image URLs.

### Image Storage

- MVP: images stored on personal VPS (Dokploy).
- Monitor disk usage growth (each user = body photo + multiple garment photos).
- Future: dedicated object storage when VPS becomes a bottleneck.

### AI Model Usage

- Nano Banana Pro via external inference service. No commercial usage restrictions identified.
- Monitor model terms of service as usage scales.

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **Own-wardrobe virtual try-on**: Existing solutions (Zeekit/Walmart, Google Shopping) serve e-commerce — trying brand items before purchase. Wearbloom reverses the paradigm: try on what you already own. No mainstream competitor in this space.

2. **Cost-aligned monetization**: The free wardrobe storage + paid AI render model aligns the technical cost driver (GPU inference) with the revenue unit. Non-paying users cost virtually nothing.

3. **Anti-fast-fashion positioning**: A fashion app that discourages consumption. Paradoxical, memorable, values-driven identity resonating with environmentally conscious Gen Z.

### Market Context

- Virtual try-on apps serve e-commerce (buy NEW clothes). No competitor targets "try on what you already own."
- Wardrobe management apps (Acloset, Cladwell) lack AI-powered visual try-on.
- Wearbloom sits at the intersection: AI try-on technology + personal wardrobe management.

## Mobile App Specific Requirements

### Technical Architecture

- **Framework**: React Native with Expo. Managed workflow, EAS Build for iOS without Mac, OTA updates.
- **State management**: Local wardrobe data cached for offline browsing. Server as source of truth.
- **API layer**: REST API between React Native client and VPS backend for image upload, inference requests, auth, and subscription management.

### Platform Requirements

- **Primary**: iOS (App Store). Minimum iOS version TBD per Expo requirements.
- **Android**: Not at MVP. React Native enables future expansion with minimal effort.
- **Build pipeline**: Cloud-based iOS builds via EAS Build (no Mac required).

### Device Permissions

| Permission | Usage | Required At |
|------------|-------|-------------|
| Camera | Body photo capture, garment photography | First use (onboarding) |
| Photo Library | Import garment photos or body photo from gallery | When user chooses import |
| Notifications | Coach reminders, streak nudges | Post-MVP |

### Offline Mode

- **Offline**: Browse wardrobe, view previous renders
- **Online required**: AI try-on rendering, image upload, subscription management, account sync
- **Local cache**: Garment thumbnails and metadata cached for fast offline browsing
- **Sync**: Uploads queued when connection restored

### Implementation Considerations

- **No Mac**: iOS testing via cloud builds + physical device or TestFlight. Expo Go for rapid dev iteration.
- **Solo dev**: Expo managed workflow minimizes native config. Focus time on product, not tooling.
- **Image handling**: Compress photos before upload to reduce bandwidth and VPS storage costs.

## Project Scoping & Phased Development

### Pre-Development Validation (Priority Zero)

Before writing any code:
1. Test Nano Banana Pro with diverse clothing categories and body types
2. Identify 3-5 categories where render quality consistently delivers wow
3. Validate inference time (target: 5-10 seconds)
4. Estimate per-render cost to confirm business model viability

### Phase 1 — MVP (Validation)

**Hypothesis:** "Will people pay to see an AI render of themselves wearing their own clothes?"

**Resource:** Solo developer (Axel), React Native + Expo, personal VPS (Dokploy), external AI inference, zero burn rate.

**Must-Have:**
- User account creation + body photo capture (camera or gallery import)
- Garment upload (camera + gallery) with basic categorization
- Stock garment library for frictionless first try-on
- Single-garment AI virtual try-on rendering (external inference service)
- Free try-on renders (configurable count, server-side) as trial mechanism, first render available during onboarding without account. Then weekly subscription with 7-day free trial (~4.99€/week)
- Credits not consumed on technical failures or user-reported bad renders
- Limited clothing categories (only where model performs well)
- Render quality feedback button
- 3-step onboarding with example photos at each step
- First-launch consent screen + privacy policy (Apple compliance)
- HTTPS, secure image storage on VPS

**Explicitly NOT in MVP:**
- Multi-garment outfit composition
- Preview without AI (lightweight positioning)
- Coach character and push notifications
- Streaks, daily log, weather widget
- Affiliate system, content export with watermark
- Admin dashboard (use Dokploy logs + direct DB queries)

### Phase 2 — Growth (Make It Addictive)

- Complete outfit composition (top + bottom + accessories)
- Preview without AI for quick browsing
- Coach character with push notifications
- Daily 1-tap outfit log + streak system
- Weather widget on main screen
- Occasion boards (work, evening, casual)
- Content export with watermark
- Affiliate program with tracking links
- Basic admin dashboard with metrics


### Phase 3 — Expansion (Scale & Monetize Further)

- Pinterest integration (import looks, recreate with own wardrobe)
- Automatic daily outfit suggestion by AI
- E-commerce integration (wardrobe gap suggestions)
- Vinted/thrift store integration
- Suitcase mode
- Wardrobe usage stats and declutter aid
- Friend try-on sharing
- Android launch

### Risk Mitigation

**Technical:** AI render quality is the #1 risk. Mitigation: test model extensively before development, launch only validated categories. No Mac constraint mitigated by Expo + EAS Build.

**Market:** Daily wardrobe ritual adoption is unproven. Mitigation: stock photos reduce onboarding friction to near-zero, 3 free credits let users experience value, weekly subscription keeps commitment low. First subscriber within 1 week is the validation signal.

**Resource:** Solo dev = everything takes longer. Mitigation: ultra-lean MVP, Expo reduces build complexity, bootstrap approach means no runway pressure.

## Functional Requirements

### User Account & Identity

- **FR1**: User can create an account and authenticate
- **FR2**: User can provide a photo of themselves to create their body avatar (camera capture or gallery import)
- **FR3**: User can update their body avatar with a new photo
- **FR4**: User can delete their account and all associated data
- **FR5**: User can view and accept privacy policy and data usage terms at first launch

### Wardrobe Management

- **FR6**: User can add a garment by taking a photo with the camera
- **FR7**: User can add a garment by importing a photo from their device gallery
- **FR8**: User can assign a category to a garment when adding it
- **FR9**: User can browse their garment collection offline
- **FR10**: User can remove a garment from their wardrobe
- **FR11**: User can view stock garments provided by the app

### Virtual Try-On

- **FR12**: User can select a single garment and generate an AI virtual try-on render on their body avatar
- **FR13**: User can view the result of a completed try-on render
- **FR14**: User can retry a try-on render. Credit policy: successful render consumes one credit; technical failure (timeout, service error) does not consume a credit; user-reported bad render (quality feedback) refunds the credit
- **FR15**: User can submit quality feedback on a render with quick categorization
- **FR16**: System limits available garment categories to those validated for render quality

### Subscription & Credits

- **FR17**: New users receive a limited number of free try-on renders as a trial mechanism. The first render is available without account creation (during onboarding). Additional free renders are granted upon account creation. The exact count is a server-side configuration
- **FR18**: Each AI try-on render consumes one credit for non-subscribers. Credits are not consumed on technical failures or user-reported bad renders (see FR14). Subscribers have unlimited renders with no credit tracking
- **FR19**: User can subscribe to a weekly plan (~4.99€/week) with a 7-day free trial. Trial and subscription managed as Apple auto-renewable subscription. Subscribers get unlimited try-on renders with no credit counter displayed
- **FR20**: Subscription is managed through Apple In-App Purchase
- **FR21**: User can view their remaining credit count
- **FR22**: User can cancel subscription through standard iOS subscription management

### Onboarding

- **FR23**: New user is guided through a 3-step onboarding flow (photo of yourself → pick a garment → first try-on result). Each step shows an example photo of the expected input.
- **FR24**: New user can select example/stock photos at each onboarding step to experience the full try-on flow without providing own photos
- **FR25**: User can replace example photos with their own at any time after onboarding

### Data & Sync

- **FR26**: User's wardrobe data and garment thumbnails are cached locally for offline browsing
- **FR27**: User's garment photos are stored securely on the server
- **FR28**: All data transfers between app and server are encrypted (HTTPS)

## Non-Functional Requirements

### Performance

- App UI interactions (scroll, navigate) respond in < 300ms
- AI try-on render completes within 5-10 seconds (external inference service)
- Time from app download to first try-on result < 60 seconds (using stock photos)
- Local wardrobe browsing works offline with no perceptible delay (cached thumbnails)

### Security

- All client-server communication over HTTPS
- User photos stored with access control (no publicly accessible URLs)
- Authentication tokens stored securely on device (iOS Keychain via Expo SecureStore)
- Account deletion removes all user data (photos, avatar, wardrobe, usage history)
- API endpoints authenticated — no unauthenticated access to user data

### Scalability

- MVP infrastructure sized for early adopter usage (tens to low hundreds of users)
- Backend architecture must not preclude horizontal scaling
- AI inference handled by external service — scales independently from backend
- Image storage growth monitored — migration path to object storage when needed

### Integration

- Apple In-App Purchase for subscription management (StoreKit)
- External AI inference service (Nano Banana Pro) via API — handle timeouts and unavailability gracefully
- Inference service errors: show user-friendly error, don't consume credit
