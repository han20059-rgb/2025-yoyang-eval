<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 평가 (2025-yoyang-eval)

Next.js. 공유 Supabase RPC. 운영 URL: 평가 앱 Vercel 별칭.

공통 원칙: `.cursor/rules/dev-common.mdc` (alwaysApply). 큰 설계 절차: `/wayfinder` → `.cursor/skills/wayfinder/SKILL.md` (매 대화 자동 로드 아님). 안내: `docs/cursor-shared-setup.md`. 원본 맞추기: 근무표 저장소에서 `node scripts/sync-shared-cursor.mjs`.

## 보안

- 직원 세션: `eval_list_org_checks`, `eval_list_assignment_overrides`. 관리자 전용으로 바꾸지 말 것.
- `eval_is_staff_admin`은 REST 호출 금지. 관리자 판별은 `eval_staff_is_admin(token)`.
- 운영 DB·Auth·Storage·커밋·푸시·배포는 사용자 승인 전 금지.
- 공유 보안 명세는 근무표 저장소 `docs/보안-공유supabase-작업명세.md`.
