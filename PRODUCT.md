# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A creative team or studio: creative directors and designers working across motion design, 3D, AR/VR and immersive experiences, branding and UI. They collect references while they work (on a phone between tasks, at a desk mid-project) and come back to them when a project needs direction. An AI agent, set up by the team, also collects references on their behalf.

## Product Purpose

Ilham (إلهام) is the team's own inspiration library in the spirit of Dribbble and Behance. References are links to real works, gathered into projects. Each one gets a clear preview, and opening it always leads to the original work's page. Success means the team finds the reference they need quickly, and agent-collected references arrive in the right project ready to judge.

## Positioning

References come from anywhere (Dribbble, Behance, YouTube, Vimeo, Awwwards, any page) into one library the team owns, and an agent can fill a project by brief. It is a collector's working surface, not a social feed: no likes, followers or public profiles.

## Operating Context

- Capture: paste or drop a link, the add dialog, a bookmarklet that runs on the page being viewed, and the Android share sheet (`/add`).
- Automation: an agent adds references through an API/MCP layer; its picks carry a reason and land in an Inbox for triage. Review is a setting: off for the account or per project, picks join the board directly, still marked ✦.
- Every reference has a sheet with its credits (creator and portfolio, publish date, the creator's own description, how it was made, software used) and a notes thread where agents and the owner talk about that piece; any connected agent (Codex, ChatGPT, Claude, Grok…) can join that thread from an invite link, answer, and wait for the next note; with ANTHROPIC_API_KEY set, Claude can also answer on its own, grounded in the work and the web. Credits come from the page itself first; agents research the rest.
- Some platforms block server-side fetching (Dribbble, Behance, ArtStation). Those references are still saved and still open the source; a preview can be supplied by upload, image URL, the bookmarklet, or the agent.

## Capabilities and Constraints

- Built today: projects, capture paths, preview pipeline (oEmbed / OpenGraph / browser fallback → WebP previews), dedupe per project, move/delete with undo, live updates, the agent API/MCP with the Inbox, and the reference sheet with credits and notes.
- Stack: Next.js on Vercel (UI + ingest route handlers + Vercel Blob for previews), Firebase on the free Spark plan (Firestore, Auth). No Blaze.
- Data is currently scoped to a single owner (`users/{uid}`). **Open decision:** team workspaces (shared projects, members, roles) are required by the confirmed audience but not designed yet.
- Planned: scheduled curation (Phase 3), search, color and semantic search, Present Mode and client share links (Phase 4). See `docs/PLAN.md`.

## Brand Commitments

- Name: Ilham / إلهام.
- Interface language today: Arabic (RTL) in a conversational Gulf voice. Whether to add English is an open decision.

## Evidence on Hand

No testimonials, customers, metrics or case studies exist. Do not invent any.

## Product Principles

1. The work leads; the interface serves it.
2. Every reference opens its original source.
3. Capture costs one gesture, from any device.
4. Agent work is visible as agent work.
5. Nothing is lost: blocked or failed previews still save the reference and offer a recovery.

## Accessibility & Inclusion

WCAG 2.2 AA: text contrast ≥4.5:1, touch targets ≥44px on phones, full keyboard path, and `prefers-reduced-motion` honored. Mixed Arabic/English content must keep RTL alignment.
