# Existing Data Model and Invariants

No schema migration planned.

| Entity | Existing use | Invariant |
| --- | --- | --- |
| learn_lessons + topic/course | Reviewed version, slug/locale, sections/practice/cards, subject/grade | Filter visibility before latest version; no client grade/review override |
| Tutor request | Lesson/mode/question/locale/item/hint/recovery | Strict bounds; identity from session |
| Tutor response | Answer/source/references/formative flag and optional recommendation | Reference structure does not alone prove semantic support |
| Existing practice results | getPracticeResult verified attempts | Learner scoped; authoritative scoring |
| learn_review_attempts | Submitted feedback topics_to_revise | No open-paper evidence; guard answer disclosure |
| learn_flashcard_reviews | Last rating/due time | Learner scoped, read-only recommendation input |
| Controls/usage/assessment lock | Existing services/routes | Recheck after provider success/failure |
| React panel state | Up to ten displayed exchanges | Ephemeral, cleared on lesson/panel lifecycle |

Tutor reads progress; existing engines score/reward. T011 selects visible rows before applying evidence priority, without modifying history or inventing mastery transfer.
