# Stability Notes - 2026-03-26

## Quiz Recovery

The quiz runtime incident that affected existing activities has been treated as an operations issue, not just a code issue.

- Symptom: existing quizzes failed at runtime and newly created quizzes became unreliable.
- Deployed outcome: quiz playback is working again in production after the Synology pull and rebuild.
- Operational rule: when quiz runtime behavior changes, verify both new creation and existing stored content before promoting the build.

## Scheduled Tasks

Scheduled task handling was tightened to match how families use the app day to day.

- Child-facing task lists should show what is actionable now, not future scheduled copies.
- Overdue tasks remain actionable and should be treated as "do now" items instead of disappearing.
- Completing a recurring task should not make the child think the same task is still due today when the app has actually created the next dated copy.

## Habit Accuracy

Task completion needs to update habit-style tracking consistently across every completion path.

- Standard completion
- Timer completion
- Parent-approved photo-proof completion

The expected behavior is:

- `last_completed_date` is written when a task is truly completed.
- Task streak and related habit indicators are updated from every valid completion path.
- Recurring follow-up tasks keep their timer settings so scheduled routines stay consistent.
