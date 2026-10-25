Implements #12: turns the per-lesson chat into five teaching modes grounded in reviewed lesson sections, with grade/language adaptation, safe authored progressive hints, guided use of existing practice, formative understanding checks and deterministic recommendations from verified practice/review/flashcard evidence.

Reuses existing AI providers, quotas and activity scoring. Adds bounded provider context, validated section references, useful offline/quota fallbacks, ephemeral conversations and per-profile rate limiting. All modes enforce existing controls and shared assessment locks; pending provider replies recheck locks, controls and lesson review status. No dependency, research JSON, production data or published lesson changes.

Stacked on PR #11 at `052e8ae32dad9d567e9eab3390fbb8cf40a67de6`, targeting `feature/familyhub-learn-grades-1-10`. Claude's activity/assessment/review fixes are preserved unchanged. Tutor route wiring is a focused commit.

Validation:

- Backend TypeScript build: PASS.
- Frontend TypeScript/Vite/PWA build: PASS.
- Tutor unit/API/real-page browser suite: 25 PASS. Disposable in-memory DB, synthetic reviewed fixtures and fake/offline providers. Real lesson page and existing practice scoring exercised on desktop/light and mobile/dark, including keyboard/source focus, wrong answer → hints → formative feedback → verified recommendation → English scaffolding/recovery.
- Full backend suite: 174 PASS, 1 FAIL, 1 optional browser test skipped. Failure is unchanged `gamification.test.ts:149`: on Sunday, a Friday task is outside the Sunday-start current week. Tutor/grades/lock regression suites pass.
- Backend audit: 31 existing findings (3 critical, 17 high, 10 moderate, 1 low); dependencies/lockfiles unchanged.
- `git diff --check`: PASS.

See `docs/familyhub-learn-tutor-v2.md` and `evidence/tutor-v2/` for commands, outputs, screenshots and reproduction details. Draft for review because the full suite has the documented baseline failure and Project Init has no current release baseline/approval receipts. Human teaching-quality/screen-reader review and optional real-provider validation remain manual. No merge, Docker deploy, curriculum approval or child rollout requested.
