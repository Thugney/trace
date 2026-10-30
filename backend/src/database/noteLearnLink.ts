import type { Database } from 'better-sqlite3';

/**
 * Additive migration: link a sticky note to the Learn lesson it was written in.
 * Kept apart from init.ts so tests can run it against their own database.
 */
export function migrateNotesLearnLink(database: Database) {
  try {
    const notesInfo: any[] = database.prepare('PRAGMA table_info(notes)').all();
    const hasLessonId = notesInfo.some((col: any) => col.name === 'learn_lesson_id');
    const hasTopicId = notesInfo.some((col: any) => col.name === 'learn_topic_id');

    if (!hasLessonId) {
      console.log('🔄 Migrating notes table: adding learn_lesson_id column...');
      database.prepare('ALTER TABLE notes ADD COLUMN learn_lesson_id INTEGER DEFAULT NULL').run();
      console.log('✅ Migration completed: learn_lesson_id column added to notes');
    }

    if (!hasTopicId) {
      console.log('🔄 Migrating notes table: adding learn_topic_id column...');
      database.prepare('ALTER TABLE notes ADD COLUMN learn_topic_id INTEGER DEFAULT NULL').run();
      console.log('✅ Migration completed: learn_topic_id column added to notes');
    }

    database.prepare('CREATE INDEX IF NOT EXISTS idx_notes_profile_lesson ON notes(profile_id, learn_lesson_id)').run();
  } catch (error: any) {
    console.error('Migration error (notes learn link):', error.message);
  }
}
