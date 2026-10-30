import db from '../../database/init';
import { getOpenAssessment } from './assessmentLock';
import type { LessonRow } from './catalog';

/**
 * Learn lesson notes (specs/003-learn-lesson-notes).
 *
 * A lesson note is an ordinary sticky note whose learn_lesson_id is set, so it
 * also shows on /notes. Parent notes are read from learn_assignments, never
 * copied. While the owner has a test running, every child-facing view withholds
 * them and every change is refused, like the tutor and model answers.
 */

export const LESSON_NOTE_MAX_LENGTH = 2000;
export const LESSON_NOTES_PER_LESSON = 30;
// The Notes page palette
export const NOTE_COLORS = ['#fef08a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#e9d5ff', '#fed7aa'];
export const DEFAULT_NOTE_COLOR = NOTE_COLORS[0];

type NoteRow = {
  id: number;
  profile_id: number;
  title: string;
  content: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  learn_lesson_id: number | null;
  learn_topic_id: number | null;
};

export type ParentAssignmentNote = {
  assignment_id: number;
  note: string;
  from_name: string;
  target_kind: string;
  title: string;
  lesson_id: number | null;
  due_at: string | null;
  state: string;
};

export const notesLocked = (profileId: number) => Boolean(getOpenAssessment(profileId));

export const noteColor = (value: unknown) =>
  (typeof value === 'string' && NOTE_COLORS.includes(value) ? value : DEFAULT_NOTE_COLOR);

export function cleanNoteContent(value: unknown): { content: string } | { error: 'note_empty' | 'note_too_long' } {
  const content = typeof value === 'string' ? value.trim() : '';
  if (!content) return { error: 'note_empty' };
  if (content.length > LESSON_NOTE_MAX_LENGTH) return { error: 'note_too_long' };
  return { content };
}

export function presentLessonNote(row: NoteRow) {
  return { id: row.id, content: row.content || '', color: row.color, created_at: row.created_at, updated_at: row.updated_at };
}

export function getLessonNote(noteId: number): NoteRow | undefined {
  return db.prepare('SELECT * FROM notes WHERE id = ? AND learn_lesson_id IS NOT NULL').get(noteId) as NoteRow | undefined;
}

export function listLessonNotes(profileId: number, lessonId: number) {
  return (db.prepare(`
    SELECT * FROM notes WHERE profile_id = ? AND learn_lesson_id = ? ORDER BY created_at DESC, id DESC
  `).all(profileId, lessonId) as NoteRow[]).map(presentLessonNote);
}

export function countLessonNotes(profileId: number, lessonId: number) {
  return (db.prepare('SELECT COUNT(*) as n FROM notes WHERE profile_id = ? AND learn_lesson_id = ?')
    .get(profileId, lessonId) as { n: number }).n;
}

export function createLessonNote(profileId: number, lesson: LessonRow, content: string, color: string) {
  const result = db.prepare(`
    INSERT INTO notes (profile_id, title, content, color, category, learn_lesson_id, learn_topic_id)
    VALUES (?, ?, ?, ?, 'School', ?, ?)
  `).run(profileId, lesson.title.slice(0, 200), content, color, lesson.id, lesson.topic_id);
  return presentLessonNote(db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid) as NoteRow);
}

export function updateLessonNote(noteId: number, content: string, color: string) {
  db.prepare('UPDATE notes SET content = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content, color, noteId);
  return presentLessonNote(db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as NoteRow);
}

/** A child's non-cancelled assignments that carry a note, optionally only those covering one lesson. */
export function assignmentNotesForChild(childId: number, lesson?: LessonRow): ParentAssignmentNote[] {
  const rows = db.prepare(`
    SELECT a.id, a.note, a.lesson_id, a.topic_id, a.due_at, a.state, p.name as from_name,
           COALESCE(a.target_kind, CASE WHEN a.mock_exam_id IS NOT NULL THEN 'mock_exam' ELSE 'lesson' END) as target_kind,
           l.title as lesson_title, l.review_status as lesson_status, t.title as topic_title,
           e.title as mock_exam_title, rp.title as review_paper_title
    FROM learn_assignments a
    JOIN profiles p ON p.id = a.assigned_by
    LEFT JOIN learn_lessons l ON l.id = a.lesson_id
    LEFT JOIN learn_topics t ON t.id = a.topic_id
    LEFT JOIN learn_mock_exams e ON e.id = a.mock_exam_id
    LEFT JOIN learn_review_papers rp ON rp.id = a.review_paper_id
    WHERE a.child_id = ? AND a.state != 'cancelled' AND a.note IS NOT NULL AND TRIM(a.note) != ''
    ORDER BY CASE a.state WHEN 'assigned' THEN 0 ELSE 1 END, a.created_at DESC
  `).all(childId) as any[];

  return rows
    .filter((row) => !lesson
      || (row.target_kind === 'topic' ? row.topic_id === lesson.topic_id
        : row.target_kind !== 'mock_exam' && row.lesson_id === lesson.id))
    .map((row) => ({
      assignment_id: row.id,
      note: row.note,
      from_name: row.from_name,
      target_kind: row.target_kind,
      title: row.target_kind === 'review_paper' ? row.review_paper_title
        : row.target_kind === 'topic' ? row.topic_title
          : row.target_kind === 'mock_exam' ? row.mock_exam_title : row.lesson_title,
      // Link only to a lesson the child can open
      lesson_id: row.target_kind !== 'mock_exam' && row.lesson_status === 'reviewed' ? row.lesson_id : null,
      due_at: row.due_at,
      state: row.state
    }));
}

/** The lesson payload's notes block for its viewer. */
export function lessonNotesBlock(profileId: number, lesson: LessonRow) {
  if (notesLocked(profileId)) {
    return { locked: true, mine: [], from_parents: [], limit: LESSON_NOTES_PER_LESSON };
  }
  return {
    locked: false,
    mine: listLessonNotes(profileId, lesson.id),
    from_parents: assignmentNotesForChild(profileId, lesson),
    limit: LESSON_NOTES_PER_LESSON
  };
}

/** A child's lesson notes grouped by subject, then lesson, for the parent view. */
export function childLessonNotesBySubject(childId: number) {
  const rows = db.prepare(`
    SELECT n.*, COALESCE(l.title, n.title) as lesson_title, l.review_status as lesson_status,
           s.slug as subject_slug, s.title as subject_title
    FROM notes n
    LEFT JOIN learn_lessons l ON l.id = n.learn_lesson_id
    LEFT JOIN learn_topics t ON t.id = n.learn_topic_id
    LEFT JOIN learn_subjects s ON s.id = t.subject_id
    WHERE n.profile_id = ? AND n.learn_lesson_id IS NOT NULL
    ORDER BY COALESCE(s.sort_order, 999), s.id, n.created_at DESC, n.id DESC
  `).all(childId) as any[];

  const subjects: Array<{
    subject_slug: string | null;
    subject_title: string | null;
    lessons: Array<{ lesson_id: number; lesson_title: string; lesson_visible: boolean; notes: ReturnType<typeof presentLessonNote>[] }>;
  }> = [];
  for (const row of rows) {
    let subject = subjects.find((item) => item.subject_slug === row.subject_slug);
    if (!subject) {
      subject = { subject_slug: row.subject_slug, subject_title: row.subject_title, lessons: [] };
      subjects.push(subject);
    }
    let lessonGroup = subject.lessons.find((item) => item.lesson_id === row.learn_lesson_id);
    if (!lessonGroup) {
      lessonGroup = { lesson_id: row.learn_lesson_id, lesson_title: row.lesson_title, lesson_visible: row.lesson_status === 'reviewed', notes: [] };
      subject.lessons.push(lessonGroup);
    }
    lessonGroup.notes.push(presentLessonNote(row));
  }
  return subjects;
}

const LEARN_CONTEXT_SELECT = `
  SELECT n.*, l.title as learn_lesson_title, s.title as learn_subject_title, s.slug as learn_subject_slug,
         CASE WHEN l.review_status = 'reviewed' THEN 1 ELSE 0 END as learn_lesson_visible
  FROM notes n
  LEFT JOIN learn_lessons l ON l.id = n.learn_lesson_id
  LEFT JOIN learn_topics t ON t.id = n.learn_topic_id
  LEFT JOIN learn_subjects s ON s.id = t.subject_id
`;

/**
 * Notes with their Learn context for /api/notes. `where` uses the `n.` alias.
 * Falls back to plain notes when Learn has never been initialised.
 */
export function selectNotesWithLearnContext(where: string, params: unknown[]): any[] {
  let rows: any[];
  try {
    rows = db.prepare(`${LEARN_CONTEXT_SELECT} WHERE ${where}`).all(...params) as any[];
  } catch (error: any) {
    if (!/no such (table|column)/.test(error?.message || '')) throw error;
    rows = db.prepare(`SELECT n.* FROM notes n WHERE ${where}`).all(...params) as any[];
  }
  return rows.map((row) => ({ ...row, learn_lesson_visible: Boolean(row.learn_lesson_visible) }));
}
