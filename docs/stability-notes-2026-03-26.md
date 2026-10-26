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
- Overdue recurring tasks should surface in the child's "today" lane so they are treated as work to do now, not hidden in a separate bucket.
- Recurring follow-up tasks must keep `scheduled_time` so reminder behavior survives to the next occurrence.

## Overdue Task Rules

Past-due tasks are allowed, but they should be clearly explained and scored differently.

- Child-facing overdue cards should explain that the task is past due and can still be done now.
- Overdue task completion now awards half points instead of full points.
- Parent-triggered task reminders should work for approved due-today and past-due tasks without suppressing the normal scheduled reminder flow.

## Habit Accuracy

Task completion needs to update habit-style tracking consistently across every completion path.

- Standard completion
- Timer completion
- Parent-approved photo-proof completion

The expected behavior is:

- `last_completed_date` is written when a task is truly completed.
- Task streak and related habit indicators are updated from every valid completion path.
- Recurring follow-up tasks keep their timer settings so scheduled routines stay consistent.
