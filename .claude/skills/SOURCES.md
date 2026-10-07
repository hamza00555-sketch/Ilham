# Vendored agent skills

Copied from upstream so every Claude Code session on this repo gets the same design tooling.
Reviewed before vendoring: markdown instructions only, except Impeccable's `scripts/`
(a launcher that downloads its engine binary from the project's GitHub releases and refuses to
run it unless it matches the published `.sha256`).

| Skill | Upstream | Commit | License |
|---|---|---|---|
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) `.claude/skills/impeccable` (v4.5.0) | `bbcb29d` | Apache-2.0 (`LICENSE`, `NOTICE.md`) |
| `emil-design-eng` | [emilkowalski/skill](https://github.com/emilkowalski/skill) `skills/emil-design-eng` | `e8a175d` | MIT |
| `review-animations` | [emilkowalski/skill](https://github.com/emilkowalski/skill) `skills/review-animations` | `e8a175d` | MIT |
| `improve-animations` | [emilkowalski/skill](https://github.com/emilkowalski/skill) `skills/improve-animations` | `e8a175d` | MIT |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines` | `063bee9` | Vercel (fetches rules from `vercel-labs/web-interface-guidelines` at run time) |
| `react-best-practices` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/react-best-practices` | `063bee9` | MIT (per `SKILL.md`) |

## Workflow for UI work in Ilham

1. `DESIGN.md` + `PRODUCT.md` at the repo root are the source of truth for the visual system.
2. Build → `/impeccable critique` → `review-animations` → `web-design-guidelines` → `/impeccable polish`.

To update a skill: re-copy its folder from upstream and bump the commit above.
