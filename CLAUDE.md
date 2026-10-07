@AGENTS.md

# Ilham

- Product truth: `PRODUCT.md`. Visual system ("The Light Table"): `DESIGN.md` (frontmatter tokens are normative) and `.impeccable/design.json`. Roadmap: `docs/PLAN.md`.
- UI is Arabic, RTL. English strings get `dir="auto"`; Signal Lime (`--color-signal`) is only for agent-added work.
- UI work flow (skills in `.claude/skills`): `/impeccable critique` → `review-animations` → `web-design-guidelines` → `/impeccable polish`, then `.claude/skills/impeccable/scripts/impeccable detect --json app components`.
- Before pushing: `npm test`, `npm run typecheck`, `npm run lint`, `npx next build`. End-to-end: `npm run emulators` + `npm run dev:emulators` (see README).
