# Preserved Tutor Contract

Existing detail: docs/familyhub-learn-tutor-v2.md and backend/src/services/learn/tutorCoach.ts. Design03 extends this same endpoint; no new service or schema.

POST /api/learn/tutor preserves legacy {lesson_id,question}. Optional mode: explain|hint|guided_practice|check_understanding|next_step; locale: nb|en; item_key belongs to reviewed lesson; hint_level integer0–2; recovery boolean. Question max500 characters, optional for explicit modes. Reject unknown fields, identity/grade/result overrides and transcripts.

Preserve answer, source and optional provider/reason; mode output adds validated section references/formative_only and applicable hint/item/recommendation. Keep existing authentication/feature/control/quota/rate errors and strict **423** assessment lock. Provider/quota fallback never overrides denied access.

References identify reviewed lesson and actual heading/index. Valid citation structure and a supported flag alone cannot authorize unrelated answers. T010 covers dishonest supported=true/in-range citation with unrelated claims plus legitimate paraphrases/default-mode requests.

Recommendations keep lesson_id/title/reason and current reasons practice_not_passed, review_paper_missed, flashcards_missed, flashcards_due, next_in_sequence, review_current. T011 uses latest visible reviewed versions per slug/locale while preserving subject/grade and profile scope.

Hints/practice remain deterministic and reuse approved exercises. Prompts stay bounded and exclude keys, personal data and learning history. No transcript persistence, scoring or credential changes.

## Design03 optional formative practice contract

Only `mode: guided_practice` accepts `practice_answer`, a nonempty option ID of at most 100 characters, together with an explicit `item_key`, and never with `recovery: true`. The item and option must belong to this reviewed lesson. No client correctness, score, grade or identity override is accepted.

For existing reviewed multiple-choice items the response may include `practice: { key, question, options: [{id,text}] }` and `practice_feedback: 'correct' | 'try_again'`. Keys, correct IDs, explanations and rubrics are never sent. This is deterministic formative checking with no provider invocation or database writes. Existing auth, feature, child/family controls, assessment lock and rate limits apply before returning the question or feedback. Unsupported exercise types continue through the established Practice route. Recovery never evaluates an answer.
