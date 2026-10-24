import db from '../../database/init';

/**
 * FamilyHub Learn schema (docs/familyhub-learn-architecture.md §4).
 *
 * Additive and repeat-safe: CREATE TABLE/INDEX IF NOT EXISTS only. Existing
 * school_*, learning_sessions, family_quiz_*, h5p_* and book tables are never
 * altered. Learner history is never dropped on rollback; switching the `learn`
 * feature off hides it.
 */
export function ensureLearnSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS learn_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      udir_code TEXT NOT NULL,
      instruction_locale TEXT NOT NULL DEFAULT 'nb',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS learn_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES learn_subjects(id) ON DELETE CASCADE,
      goal_key TEXT NOT NULL,
      official_goal_ref TEXT,
      source_locator TEXT NOT NULL,
      goal_after_grade INTEGER NOT NULL,
      description TEXT NOT NULL,
      description_is_paraphrase INTEGER NOT NULL DEFAULT 1,
      verification_status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (verification_status IN ('unverified', 'verified')),
      source_url TEXT NOT NULL,
      curriculum_revision TEXT NOT NULL,
      UNIQUE (subject_id, goal_key, curriculum_revision)
    );
    CREATE INDEX IF NOT EXISTS idx_learn_goals_subject ON learn_goals(subject_id);

    CREATE TABLE IF NOT EXISTS learn_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES learn_subjects(id) ON DELETE CASCADE,
      grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 10),
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      prerequisite_topic_id INTEGER REFERENCES learn_topics(id) ON DELETE SET NULL,
      UNIQUE (subject_id, grade, slug)
    );
    CREATE INDEX IF NOT EXISTS idx_learn_topics_subject_grade ON learn_topics(subject_id, grade);

    CREATE TABLE IF NOT EXISTS learn_topic_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES learn_topics(id) ON DELETE CASCADE,
      goal_id INTEGER NOT NULL REFERENCES learn_goals(id) ON DELETE CASCADE,
      UNIQUE (topic_id, goal_id)
    );
    CREATE INDEX IF NOT EXISTS idx_learn_topic_goals_goal ON learn_topic_goals(goal_id);

    CREATE TABLE IF NOT EXISTS learn_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES learn_topics(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      locale TEXT NOT NULL DEFAULT 'nb',
      version INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      practice TEXT NOT NULL DEFAULT '[]',
      flashcards TEXT NOT NULL DEFAULT '[]',
      authored_by TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (review_status IN ('draft', 'reviewed', 'retired')),
      reviewed_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      review_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (topic_id, slug, locale, version)
    );
    CREATE INDEX IF NOT EXISTS idx_learn_lessons_topic ON learn_lessons(topic_id);

    CREATE TABLE IF NOT EXISTS learn_resource_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('activity', 'quiz', 'h5p', 'flashcards')),
      existing_resource_id INTEGER NOT NULL,
      learner_profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
      created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (lesson_id, kind, learner_profile_id)
    );
    CREATE INDEX IF NOT EXISTS idx_learn_resource_links_learner ON learn_resource_links(learner_profile_id);

    CREATE TABLE IF NOT EXISTS learn_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'not_started'
        CHECK (state IN ('not_started', 'reading', 'practiced', 'mastered')),
      read_at TEXT,
      practiced_at TEXT,
      best_practice_percent INTEGER,
      practice_attempt_id INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (profile_id, lesson_id)
    );
    CREATE INDEX IF NOT EXISTS idx_learn_progress_lesson ON learn_progress(lesson_id);

    CREATE TABLE IF NOT EXISTS learn_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assigned_by INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      child_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      lesson_id INTEGER REFERENCES learn_lessons(id) ON DELETE CASCADE,
      mock_exam_id INTEGER REFERENCES learn_mock_exams(id) ON DELETE CASCADE,
      due_at TEXT,
      note TEXT,
      state TEXT NOT NULL DEFAULT 'assigned' CHECK (state IN ('assigned', 'completed', 'cancelled')),
      idempotency_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      CHECK (lesson_id IS NOT NULL OR mock_exam_id IS NOT NULL),
      UNIQUE (assigned_by, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_learn_assignments_child ON learn_assignments(child_id);

    CREATE TABLE IF NOT EXISTS learn_mock_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES learn_topics(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      time_limit_minutes INTEGER NOT NULL DEFAULT 30,
      items TEXT NOT NULL,
      rubric TEXT NOT NULL,
      rubric_version INTEGER NOT NULL DEFAULT 1,
      review_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (review_status IN ('draft', 'reviewed', 'retired')),
      reviewed_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      UNIQUE (topic_id, slug, version)
    );

    CREATE TABLE IF NOT EXISTS learn_mock_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES learn_mock_exams(id) ON DELETE CASCADE,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      rubric_version INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      submitted_at TEXT,
      responses TEXT,
      score INTEGER,
      max_score INTEGER,
      outcome TEXT CHECK (outcome IN ('graded', 'insufficient_evidence')),
      indicative_grade INTEGER CHECK (indicative_grade BETWEEN 1 AND 6),
      evidence TEXT,
      feedback TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_learn_mock_attempts_profile ON learn_mock_attempts(profile_id, exam_id);

    CREATE TABLE IF NOT EXISTS learn_flashcard_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
      card_key TEXT NOT NULL,
      box INTEGER NOT NULL DEFAULT 1,
      last_rating TEXT NOT NULL CHECK (last_rating IN ('known', 'missed')),
      reviewed_at TEXT NOT NULL,
      next_due_at TEXT NOT NULL,
      UNIQUE (profile_id, lesson_id, card_key)
    );

    CREATE TABLE IF NOT EXISTS learn_personal_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
      forked_from_card_key TEXT,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_learn_personal_cards_owner ON learn_personal_cards(profile_id, lesson_id);
  `);
}
