# Feature Specification: FamilyHub Learn Tutor 2.0

**Feature Branch**: `feature/familyhub-learn-tutor-v2`  
**Created**: 2026-10-25  
**Status**: Design03 approved by the human on 2026-10-26; registration and implementation in progress.  
**Input**: [Issue #12](https://github.com/Thugney/trace/issues/12), its pinned execution contract, and [existing PR #14](https://github.com/Thugney/trace/pull/14).

This captures existing requirements and implementation, not a new feature or rebuild. No native feature spec, plan or tasks existed in the inspected project state. `001` is the first directory under the installed sequential Spec Kit convention; it is not a replacement branch or new product identifier. If an earlier authoritative artifact is found, reconcile into it rather than maintaining two specifications.

## User Scenarios & Testing

### US1 — Understand a reviewed lesson (Priority: P1)

A child in Grades 1–10 receives short teaching appropriate to the lesson's grade and language, can inspect its source section, and can ask for a smaller step.

**Why**: Useful teaching requires trustworthy sources and understandable explanations.

**Independent test**: A Grade 3 child opens a reviewed lesson, chooses Explain, follows its source link and uses recovery. Check grade bands with Grades 1, 4, 8 and 10 and both supported languages.

**Acceptance scenarios**:
1. Given a reviewed lesson, Explain uses supported material and resolves grade from the lesson's course/topic mapping.
2. Given an unsupported/off-topic question or injected instruction, the tutor defers to reviewed material rather than claiming unsupported facts or official competence goals.
3. Given “I don't understand,” the child receives a smaller concrete step rather than a repeated explanation.

### US2 — Practise and explain reasoning (Priority: P1)

A child receives progressive help after a wrong verified answer, works through existing approved practice, and explains reasoning without a chat grade.

**Why**: Help must develop understanding without bypassing scoring.

**Independent test**: Submit an incorrect answer through existing practice, request successive hints, open guided practice and answer a Check Understanding prompt.

**Acceptance scenarios**:
1. Each hint, including a directly requested later hint, avoids revealing the final answer.
2. Guided Practice opens an existing reviewed exercise; existing scoring remains authoritative.
3. Check Understanding asks for reasoning and gives formative feedback; chat never changes points or verified progress.

### US3 — Choose the next useful lesson (Priority: P1)

A child sees a reviewed next lesson with a reason based on their own verified practice, submitted review feedback or flashcard evidence.

**Why**: Recommendations must reflect demonstrated need rather than chat claims.

**Independent test**: Create different verified outcomes for two learners and compare recommendations, including multiple versions of a lesson.

**Acceptance scenarios**:
1. Verified failed practice, revision feedback and missed/due cards influence recommendations; client/chat mastery claims do not.
2. Only the latest visible reviewed version per lesson/language is eligible. A newer draft/retired version does not hide an older reviewed version; two reviewed versions do not select a superseded version.
3. When reviewed material is exhausted, suggest revision rather than inventing official material.

### US4 — Learn within family controls (Priority: P1)

A child uses accessible Bokmål/English tutoring within parental permissions, assessment locks and privacy limits, including useful deterministic help when AI is unavailable.

**Why**: Privacy and controls are integral to the learner experience.

**Independent test**: Exercise each mode with disabled controls, exhausted quota, provider failure, a second family and an active review/mock exam; verify keyboard/screen-reader behavior across mobile/desktop in light only, including devices set to dark.

**Acceptance scenarios**:
1. Disabled access and active assessments cannot be bypassed, including control changes during a provider request.
2. Provider failure/exhausted AI quota produces useful approved-source fallback where tutor access is otherwise allowed.
3. Conversation is ephemeral; no other child's context, personal notes or raw transcript is disclosed or logged.

### Edge Cases

Missing sources/items; malformed or identity-overriding requests; fabricated citations; a provider asserting support for unrelated content; newer draft/retired/reviewed versions; expired assessment submission during another active attempt; previous answer feedback during retakes; controls changed during slow/failed provider calls; empty/exhausted reviewed catalog.

## Requirements

### Functional Requirements

- **FR-001**: Preserve lesson/question clients and support Explain, Hint, Guided Practice, Check Understanding and Next Step with bounded validated input, localized output, deterministic fallback and stable error behavior.
- **FR-002**: Activate only on reviewed FamilyHub lessons; return valid section references, bound source context, resist injection/off-topic/unsupported responses, and never invent official Udir competence IDs or claim generated text is official curriculum.
- **FR-003**: Resolve grade from reviewed course/topic mapping; support simple concrete Grades 1–4 teaching, guided participation for Grades 5–7, reasoning for Grades 8–10, Bokmål/English scaffolding and smaller-step recovery.
- **FR-004**: Give progressive answer-safe hints and guide existing reviewed exercises using existing practice/scoring engines; do not create/publish generated library content.
- **FR-005**: Check understanding through explanations/questions and formative feedback; never treat chat as grades, verified progress or rewardable activity.
- **FR-006**: Recommend reviewed visible lesson versions using authenticated learner evidence only: verified attempts, submitted revision needs and flashcard reviews. Reject client-reported grades/mastery.
- **FR-007**: Enforce authentication, family/profile authorization, global and child Learn/tutor switches, AI opt-in, quotas, rate limits and provider settings. Enforce assessment locks across modes and preserve PR #11's answer-disclosure protections.
- **FR-008**: Keep conversation ephemeral and provider context minimal; exclude personal/family records, other learners, answer keys and unrelated history. Do not persist/audit raw child prompts/transcripts.
- **FR-009**: Implement human-approved Design03: immediate help buttons, owl introduction, newest-answer follow-ups, a mobile lesson context card, and a lesson column left of chat from 760 px. Use light only regardless of device preference. Replace the dock with a single card for denied access, assessment lock, rate limit or network failure. Preserve keyboard/focus, language and ephemeral history. AI quota/provider failures retain existing reviewed-source fallback; these successful fallback responses are not access denials.
- **FR-010**: Reuse existing providers/engines and research assets in `docs/learn/`; introduce no paid service, credential requirement, invented curriculum, draft publication, live-data change or production rollout.

### Key Entities

- Reviewed lesson/section: versioned language-specific content, grade/topic association and source reference.
- Tutor exchange: mode, bounded learner input and formative response with valid references; temporary only.
- Verified evidence: authenticated practice results, submitted review feedback and flashcard state.
- Recommendation: eligible reviewed lesson and evidence-derived reason.
- Family controls/assessment state: existing permission and lock decisions, never client-controlled declarations.

## Success Criteria

- **SC-001**: Grade 3 learner completes Explain → wrong scored practice → progressive Hint → Check Understanding → justified Next Step using reviewed synthetic material without chat awarding progress or dumping answers.
- **SC-002**: Demonstrations cover Grades 1, 4, 8 and 10, Bokmål/English and recovery, with links to real reviewed sections.
- **SC-003**: Every defined denied-access, active-assessment, malformed-input and cross-family case denies disclosure; provider-down/quota cases retain safe useful fallback when permitted.
- **SC-004**: Learner journey works by keyboard across light-only mobile/desktop states; device dark preference must not recolour Tutor. Human screen-reader review is separately required.
- **SC-005**: Current mandatory builds/tests, independent review, requirement/evidence mapping and genuine baseline/design approval are complete before acceptance; historical evidence is separate.

## Assumptions and Boundaries

Existing product scope is authoritative. Design03 approval is recorded in `evidence/tutor-v2/setup/human-design-v3-approval.md`; the historical Design02 baseline and references must be archived intact. Use disposable databases and reviewed synthetic fixtures. Research material may remain draft and does not establish complete full-year reviewed coverage. Real-provider smoke is optional only when configured and approved; fake providers do not establish live teaching quality. Claude owns PR #11; Codex owns PR #14. Issue #12 remains open while acceptance is blocked.

## Approved Design03 interaction amendment — 2026-10-26 (T012/T032)

The exact approved preview is `.project-init/design-v3/index.html`, SHA256 `a4b56af82c4a3229a9f727cba0fa16876089c7e71557e5fce073455119ad8f8b`. The light-only amendment supersedes prior theme requirements. Preview toolbars, device frames, sample pizza/lesson content and simulated correctness never enter product code.

Guided practice may return an existing reviewed multiple-choice question and option labels, without its answer key. A bounded `practice_answer` option ID is checked only by the server under the same Tutor authorization, assessment lock and rate limit. It returns formative `correct`/`try_again` feedback only, with no attempts, points, mastery or grade writes, and no provider call. Unsupported exercise kinds retain existing practice navigation. Requests cannot supply a claimed score, grade or correctness. Only the latest response has active practice choices and follow-ups. Recovery and language/lesson changes must not submit a stale answer.

New visual references require the human's capture-framing decision. Until then retain missing/failing comparison status; do not change thresholds, alter approved preview bytes or use implementation screenshots as references. Teaching/language and screen-reader acceptance remain open.
