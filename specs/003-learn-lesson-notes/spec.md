# Feature Specification: Learn lesson notes

**Feature Branch**: `feature/learn-notes` (cut from `release/familyhub-learn-20261030`)

**Created**: 2026-10-30

**Status**: Draft (scope chosen by the user 2026-10-30; design approval pending)

**Factory job**: `004-sticky-notes-integrated-into-learn`

**Input**: User description: "i would like the sticky notes be integrated to the learning? like real integration". Scope chosen: notes beside the lesson; the parent's assignment note as a sticky note; parents see their children's lesson notes. Not chosen: Tutor uses notes, Learn filter on /notes, highlight-to-note.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A child keeps sticky notes beside a lesson (Priority: P1)

While reading a lesson, a child writes short sticky notes in a "Mine notater" panel next to the text. The notes stay with that lesson: they are there the next time the child opens it, and they also appear among the child's notes on the notes page, marked with the lesson and subject and linking back to the lesson.

**Why this priority**: This is the integration itself. Without it, notes and Learn stay two unrelated features.

**Independent Test**: A child opens a reviewed lesson, adds a note, reloads the lesson and sees the note, then opens the notes page and sees the same note with a link that returns to the lesson.

**Acceptance Scenarios**:

1. **Given** a child with Learn switched on is reading a reviewed lesson, **When** they write a note and save it, **Then** the note appears in the lesson's notes panel and stays after the page is reloaded.
2. **Given** a child has saved notes on lesson A, **When** they open lesson B, **Then** lesson B's panel shows only lesson B's notes.
3. **Given** a child has a lesson note, **When** they open the notes page, **Then** the note is listed with the lesson title and subject, and following its link opens that lesson.
4. **Given** a child has a lesson note, **When** they change its text or colour or delete it (from the lesson or from the notes page), **Then** the change shows in both places.
5. **Given** a child has a mock exam or review paper in progress, **When** they open any lesson or the notes page, **Then** their lesson notes are not shown and cannot be created, changed or deleted until the test is submitted or expires. The lesson panel explains why.

---

### User Story 2 - A parent's assignment note appears as a sticky note (Priority: P2)

When a parent assigns a lesson, topic or review paper with a note ("Les dette før fredag!"), the child sees that note as a read-only "Fra forelder" sticky note on the lesson it belongs to and on their notes page.

**Why this priority**: Parents already write assignment notes. Showing them where the child actually studies turns them into guidance at the right moment, building on data that already exists.

**Independent Test**: A parent assigns a reviewed lesson with a note; the child opens the lesson and sees the note marked as from the parent, and sees it on the notes page too. The child cannot edit or delete it.

**Acceptance Scenarios**:

1. **Given** a parent assigned a lesson with a note, **When** the child opens that lesson, **Then** the notes panel shows the note as a read-only sticky note with the parent's name.
2. **Given** a parent assigned a topic with a note, **When** the child opens any reviewed lesson in that topic, **Then** the parent's note is shown there.
3. **Given** an assignment with a note was cancelled, **When** the child opens the lesson or the notes page, **Then** that note is no longer shown.
4. **Given** an assignment has no note, **Then** nothing extra is shown.
5. **Given** a child has a test in progress, **Then** parent notes are hidden with the child's own lesson notes until the test ends.

---

### User Story 3 - A parent reads a child's lesson notes (Priority: P3)

On the Learn parent page, a parent can open a child's lesson notes, grouped by subject and lesson, to see what the child wrote while studying. The view is read-only.

**Why this priority**: It helps parents follow their child's learning, but the child gets value without it.

**Independent Test**: A child writes notes on two lessons in two subjects; the parent opens the child on the Learn parent page and sees both notes, grouped under their subjects, with no edit controls.

**Acceptance Scenarios**:

1. **Given** a parent manages a child who has lesson notes, **When** the parent opens that child's lesson notes, **Then** the notes are listed by subject, then lesson, newest first, with the date written.
2. **Given** a parent does not manage a child, **When** they try to view that child's lesson notes, **Then** access is refused.
3. **Given** a child has no lesson notes, **Then** the parent sees a short empty message.
4. **Given** an admin views a child's lesson notes, **Then** the view is allowed and recorded in the audit log.

---

### User Story 4 - Notes stay private within the family (Priority: P1, security)

A child's notes, including lesson notes, can only be reached by that child, the parents who manage them, and an admin. Today a child can reach a sibling's notes, and some note lookups check no ownership at all. These gaps are closed as part of this feature, because lesson notes are stored and edited through the same notes service.

**Independent Test**: As one child, try to list, read, update and delete another child's notes, and to list their categories, tags and reminders; every attempt is refused and nothing changes.

**Acceptance Scenarios**:

1. **Given** two children in the same family, **When** child A requests child B's notes, categories, tags, reminders or a single note by id, **Then** access is refused.
2. **Given** child A, **When** they try to create, change or delete a note belonging to child B, **Then** it is refused and child B's notes are unchanged.
3. **Given** a parent, **When** they access notes of a child they do not manage, **Then** access is refused. Access to their own managed children's notes keeps working as today.

### Edge Cases

- A note's lesson is later retired or replaced by a new version: the note stays on the notes page; the link back is shown only while that lesson is still visible to the child.
- Learn is switched off for the child later: their lesson notes remain ordinary notes on the notes page; no Learn panel is reachable.
- The child's notes feature is switched off but Learn is on: lesson notes still work in the lesson; they simply are not reachable through the notes page.
- An assessment expires unsubmitted: notes become available again as soon as the test is no longer running.
- A child tries to attach a note to a draft (unreviewed) lesson: refused, as the lesson itself is not visible to them.
- Empty or very long text: an empty note is rejected; text beyond the limit is refused with a clear message.
- A child reaches the per-lesson limit: further notes on that lesson are refused with a message; other lessons are unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A child MUST be able to create a sticky note attached to a reviewed lesson they can see, with text and one of the existing note colours.
- **FR-002**: A lesson note MUST record the lesson and its topic, so its subject can be shown without the child entering it.
- **FR-003**: The lesson Read view MUST show the child's own notes for that lesson, newest first, beside the lesson text, and on narrow screens below it.
- **FR-004**: The child MUST be able to edit the text and colour of, and delete, their own lesson notes from the lesson and from the notes page.
- **FR-005**: Lesson notes MUST appear on the child's notes page as normal notes, showing the lesson title and subject and linking back to the lesson while that lesson is visible to them.
- **FR-006**: While the child has a mock exam or review paper in progress, the system MUST withhold the child's lesson notes and parent assignment notes from every view the child can use (lesson page and notes page), and MUST refuse creating, changing or deleting lesson notes. The lesson panel MUST say, in Bokmål, that notes are paused during the test.
- **FR-007**: A parent's assignment note MUST be shown to the child as a read-only "Fra forelder" sticky note, with the parent's name, on each reviewed lesson the assignment covers (the lesson, every reviewed lesson of an assigned topic, or a review paper's anchor lesson), and on the child's notes page.
- **FR-008**: Cancelled assignments' notes MUST NOT be shown. Notes from completed assignments remain visible.
- **FR-009**: A parent MUST be able to view, read-only, the lesson notes of each child they manage, grouped by subject and lesson. Parents MUST NOT be able to change a child's lesson notes from this view.
- **FR-010**: An admin's view of a child's lesson notes MUST be written to the audit log.
- **FR-011**: Only the note's owner, a parent who manages the owner, or an admin MAY read a note; the same rule MUST apply to listing notes, categories, tags and reminders, and to reading a single note by id.
- **FR-012**: Only the note's owner, a parent who manages the owner, or an admin MAY create, change or delete a note through the notes page. A lesson note MAY only be created by its owner from a lesson; inside Learn, only the owner MAY change or delete it, and the Learn parent view is read-only.
- **FR-013**: A lesson note MUST NOT be empty and MUST NOT exceed 2,000 characters; a child MUST NOT have more than 30 notes on one lesson.
- **FR-014**: Existing notes and their behaviour on the notes page MUST be preserved; the data change MUST be additive and safe to run repeatedly on an existing database.
- **FR-015**: All new UI copy MUST be Bokmål (English where the lesson is in English) and use the existing light theme only.
- **FR-016**: The Tutor MUST NOT receive lesson notes (explicitly out of scope).

### Key Entities

- **Note (existing)**: A sticky note owned by one profile, with title, text, colour, category, tags, pin and reminder. Gains an optional link to one Learn lesson and its topic.
- **Lesson note**: A Note whose Learn link is set. Its subject comes from the topic.
- **Assignment note (existing)**: The free-text note a parent writes on a Learn assignment. Not copied; shown wherever its assignment applies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A child can add a note to the lesson they are reading in under 10 seconds without leaving the lesson.
- **SC-002**: 100% of lesson notes created in a lesson are visible on the child's notes page with a working link back.
- **SC-003**: During a running test, 0 lesson notes or parent assignment notes are visible to the child on any page, and 0 note changes succeed.
- **SC-004**: Every cross-child note access attempt in the security tests (list, single, categories, tags, reminders, create, update, delete) is refused.
- **SC-005**: Existing note behaviour tests keep passing unchanged, and the full backend test suite and both builds pass.

## Assumptions

- Lesson notes reuse the existing notes data and colours rather than a separate store, so they show up on the notes page for free. They get the existing "School" category and the lesson title as their title.
- "Hidden during a test" uses the same running-test rule Learn already uses for the Tutor, practice and model answers.
- Parents see children's notes today through the notes page; the Learn parent view adds a lesson-organised, read-only window onto the same data and grants no new access.
- Assignment notes are displayed from the assignment itself, not copied into the child's notes, so cancelling or completing an assignment needs no clean-up.
- The parent view shows only lesson-linked notes, not the child's other personal notes.
- Limits (2,000 characters, 30 notes per lesson) are reasonable defaults for children's study notes and can be adjusted later.
- Learn and notes feature switches keep their current meanings; the lesson panel follows Learn access.
