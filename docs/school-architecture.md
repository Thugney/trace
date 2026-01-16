# Church School Module Architecture

## Goals
- Centralize Saturday school content and homework in the app.
- Teachers see only their classes; parents see only their kids; children see only their own work.
- Admins govern everything, including feature access per profile.
- Default access for new users is school-only.

## Roles and Access
- Admin: full access; manage classes, teachers, enrollments, assignments, feedback, access flags.
- Teacher: access only assigned classes and enrolled students; create/grade assignments.
- Parent/Guardian: access only their linked children and their school progress.
- Child: access only their assignments, submissions, and feedback.

## Feature Access Model
- Global flag: `school_only_mode` blocks all non-school features for non-admins.
- Per-profile features in `profile_features`.
- Default for new profiles: `school` enabled, everything else disabled (admin gets all).

## Data Model
Core school tables:
- `school_classes`: class definitions (name, age range).
- `teacher_class_assignments`: which teacher teaches which class.
- `school_enrollments`: which students are in which classes.
- `school_assignments`: assignment metadata; includes `type` and optional `linked_quiz_id`.
- `school_assignment_attachments`: uploaded files for assignments.
- `school_submissions`: student submissions and status.
- `school_submission_attachments`: uploaded files for submissions.
- `school_feedback`: teacher feedback per submission.
- `school_student_progress`: optional rollups (attendance, grades).
- `guardian_students`: optional multi-parent/guardian mapping.

Key relationships:
- Class → many students (via enrollments).
- Class → many teachers (via teacher_class_assignments).
- Assignment → class; submission → assignment + student; feedback → submission.

## API Surface
School endpoints under `/api/school` (feature-gated):
- Classes: list, create, update, roster.
- Teacher assignments: list/add/remove teachers for class (admin only).
- Enrollments: add/remove student from class.
- Assignments: list, create, update, delete.
- Attachments: upload and view assignment/submission files.
- Submissions: list by assignment or student; create; update status.
- Feedback: create and list.

Feature access endpoints (admin only):
- `/api/profiles/:id/features` GET/PUT.

## Data Flows
Admin setup:
1) Create classes.
2) Assign teachers to classes.
3) Enroll children into classes.
4) Verify teacher/parent access.

Teacher workflow:
1) Pick class, create assignment (type, due date, attachments).
2) Review submissions and give feedback.
3) Update status (approved/needs revision).

Parent/child workflow:
1) View assignments for their class(es).
2) Submit notes and attachments.
3) Receive feedback and progress updates.

## Access Control Rules
- Teachers only see classes assigned in `teacher_class_assignments` (or legacy `assigned_class_id`).
- Parents only see children linked via `guardian_students` or legacy `parent_id`.
- Children only see their own submissions.
- Admin can see and modify everything.
- Feature access middleware blocks non-school features when disabled.

## UI Structure
Admin:
- Class Management (create defaults, assign teachers, enroll students).
- Assignment oversight (optional global list).

Teacher:
- Class selector → assignment list → submission inbox → feedback.

Parent/Child:
- Student selector (parent) → assignments → submit work → feedback stream.

## Default Class Setup
Provide a button to create default classes:
- First Class
- Second Class
- Third Class

## Known Edge Cases
- Existing databases without new columns require migrations.
- Legacy `parent_id` and `assigned_class_id` are backfilled into new mapping tables.
