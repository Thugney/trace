import db from '../../database/init';
import { GRADE8_PILOT } from './curriculum';
import type { Flashcard, LessonBody, PracticeItem } from './curriculum';
import {
  SUBJECT_SLUGS,
  articleModelAnswerMatches,
  contentHash,
  titleOf,
  loadContentPackage,
  uiLocaleOf,
  validateContentPackage,
  workedExampleOf,
  PACKAGE_FILES,
  type ContentPackage,
  type SourceLesson,
  type ValidationReport
} from './contentPackage';

/**
 * Draft-only, repeat-safe importer for the Grades 1-10 research package.
 *
 * Invariants:
 * - Refuses to write anything when validation fails.
 * - Lessons and review papers are identified by (content_id, version). A stored
 *   version is only corrected in place while it is still an unapproved draft
 *   that no learner has used (no progress, practice, cards, answers, attempts
 *   or assignments). Reviewed, retired or used versions are never updated,
 *   re-drafted or deleted; changed content for them must arrive as a new
 *   version, which starts as `draft`.
 * - Existing pilot rows (subjects, goals, topics, lessons) are never modified;
 *   the five preserved grade 8 topics only gain course/checkpoint links.
 * - Checkpoint links point at real Udir stage pages; no individual official
 *   goal IDs are created.
 */

export type ImportSummary = {
  dry_run: boolean;
  created: Record<'subjects' | 'goals' | 'courses' | 'topics' | 'topic_goals' | 'course_topics' | 'lessons' | 'review_papers', number>;
  unchanged: Record<'lessons' | 'review_papers', number>;
  refreshed: Record<'lessons' | 'review_papers', number>;
  preserved_pilot_topics: string[];
  skipped: string[];
};

export type ImportResult = {
  ok: boolean;
  import_id: number | null;
  validation: ValidationReport;
  summary: ImportSummary | null;
};

const AUTHORED_BY_PREFIX = 'FamilyHub Learn research pack';

const practiceTitle = (locale: 'nb' | 'en') => (locale === 'en' ? 'Check your understanding' : 'Sjekk forståelsen');

const checkpointDescription = (locale: 'nb' | 'en', code: string, afterGrade: number) => (locale === 'en'
  ? `Competence aims after Year ${afterGrade} in ${code}. The Udir page lists every aim for this stage; links to individual aims have not been checked.`
  : `Kompetansemål etter ${afterGrade}. trinn i ${code}. Udir-siden samler alle målene for trinnet; koblingen til enkeltmål er ikke kontrollert.`);

const paperTitle = (locale: 'nb' | 'en', subjectTitle: string, grade: number) => (locale === 'en'
  ? `Review: ${subjectTitle}, Year ${grade}`
  : `Repetisjon: ${subjectTitle} ${grade}. trinn`);

export const checkpointGoalKey = (afterGrade: number) => `checkpoint-${afterGrade}`;
export const curriculumRevisionFor = (code: string) => `LK20 ${code}`;

/** Maps a source micro-lesson to the existing LessonBody render model without rewriting text. */
export function toLessonBody(lesson: SourceLesson): LessonBody {
  const example = workedExampleOf(lesson);
  // The source repeats the worked example as one of its sections; render it once, as the example
  const exampleSection = lesson.article.sections.find((section) => section.text === example.explanation);
  return {
    intro: lesson.article.intro,
    sections: lesson.article.sections
      .filter((section) => section !== exampleSection)
      .map((section) => ({ heading: section.heading, paragraphs: [section.text] })),
    workedExamples: [{
      title: exampleSection?.heading || (uiLocaleOf(lesson) === 'en' ? 'Example' : 'Eksempel'),
      problem: example.explanation,
      steps: [],
      answer: example.result
    }],
    keyTerms: [],
    checkYourself: [lesson.article.comprehension_check],
    keyTakeaway: lesson.article.key_takeaway
  };
}

/** The keyed single-select prompt becomes an existing-engine multiple_choice activity. */
export function toPracticeItems(lesson: SourceLesson): PracticeItem[] {
  const objective = lesson.practice[0];
  return [{
    key: objective.id,
    type: 'multiple_choice',
    title: practiceTitle(uiLocaleOf(lesson)),
    content: {
      question: objective.question,
      options: objective.options.map((option) => ({ id: option.key, text: option.label }))
    },
    correct: { correctAnswer: objective.correct_key },
    hints: [lesson.article.key_takeaway],
    explanation: objective.explanation
  }];
}

export type OpenPrompt = { key: string; question: string; model_answer: string };

export const toOpenPrompts = (lesson: SourceLesson): OpenPrompt[] => [{
  key: lesson.practice[1].id,
  question: lesson.practice[1].question,
  model_answer: lesson.practice[1].model_answer
}];

export const toFlashcards = (lesson: SourceLesson): Flashcard[] =>
  lesson.flashcards.map((card, index) => ({ key: `${lesson.id}-fc${index + 1}`, front: card.front, back: card.back }));

class DryRunRollback extends Error {}

const exists = (sql: string, id: number) => Boolean(db.prepare(sql).get(id));

/** Any learner record pointing at the lesson makes it immutable for the importer. */
export function isLessonInUse(lessonId: number): boolean {
  return [
    'SELECT 1 FROM learn_progress WHERE lesson_id = ? LIMIT 1',
    'SELECT 1 FROM learn_resource_links WHERE lesson_id = ? LIMIT 1',
    'SELECT 1 FROM learn_flashcard_reviews WHERE lesson_id = ? LIMIT 1',
    'SELECT 1 FROM learn_personal_cards WHERE lesson_id = ? LIMIT 1',
    'SELECT 1 FROM learn_open_responses WHERE lesson_id = ? LIMIT 1',
    'SELECT 1 FROM learn_assignments WHERE lesson_id = ? LIMIT 1'
  ].some((sql) => exists(sql, lessonId));
}

export function isPaperInUse(paperId: number): boolean {
  return exists('SELECT 1 FROM learn_review_attempts WHERE paper_id = ? LIMIT 1', paperId)
    || exists('SELECT 1 FROM learn_assignments WHERE review_paper_id = ? LIMIT 1', paperId);
}

export const pilotGrade8Topics = () => GRADE8_PILOT.map((subject) => ({ subject: subject.slug, slug: subject.topic.slug }));

export function importContentPackage(
  pkg: ContentPackage,
  options: { dryRun?: boolean; triggeredBy?: number | null } = {}
): ImportResult {
  const dryRun = options.dryRun === true;
  const validation = validateContentPackage(pkg, { existingGrade8PilotTopics: pilotGrade8Topics() });
  const packageName = pkg.manifest.package;

  const logImport = (status: 'ok' | 'failed', summary: ImportSummary | null) => {
    const result = db.prepare(`
      INSERT INTO learn_content_imports (package, source_hash, dry_run, status, summary, errors, warnings, triggered_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      packageName, pkg.sourceHash, dryRun ? 1 : 0, status,
      JSON.stringify({ stats: validation.stats, ...(summary || {}) }),
      JSON.stringify(validation.errors), JSON.stringify(validation.warnings), options.triggeredBy ?? null
    );
    return Number(result.lastInsertRowid);
  };

  if (!validation.ok) {
    return { ok: false, import_id: logImport('failed', null), validation, summary: null };
  }

  const summary: ImportSummary = {
    dry_run: dryRun,
    created: { subjects: 0, goals: 0, courses: 0, topics: 0, topic_goals: 0, course_topics: 0, lessons: 0, review_papers: 0 },
    unchanged: { lessons: 0, review_papers: 0 },
    refreshed: { lessons: 0, review_papers: 0 },
    preserved_pilot_topics: [],
    skipped: []
  };
  const importedAt = new Date().toISOString();
  const authoredBy = `${AUTHORED_BY_PREFIX} ${pkg.manifest.prepared_on} (original micro-lesson draft)`;

  const insertSubject = db.prepare(`
    INSERT INTO learn_subjects (slug, title, udir_code, instruction_locale, sort_order)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(slug) DO NOTHING
  `);
  const insertGoal = db.prepare(`
    INSERT INTO learn_goals (
      subject_id, goal_key, official_goal_ref, source_locator, goal_after_grade, description,
      description_is_paraphrase, source_url, curriculum_revision, goal_level
    ) VALUES (?, ?, NULL, ?, ?, ?, 0, ?, ?, 'checkpoint')
    ON CONFLICT(subject_id, goal_key, curriculum_revision) DO NOTHING
  `);
  const upsertCourse = db.prepare(`
    INSERT INTO learn_courses (
      course_key, subject_id, grade, title, curriculum_code, checkpoint_after_grade, checkpoint_url,
      track_type, assessment_mode, grading_mode, locale, source_package
    ) VALUES (@course_key, @subject_id, @grade, @title, @curriculum_code, @checkpoint_after_grade, @checkpoint_url,
      @track_type, @assessment_mode, @grading_mode, @locale, @source_package)
    ON CONFLICT(course_key) DO UPDATE SET
      title = excluded.title, curriculum_code = excluded.curriculum_code,
      checkpoint_after_grade = excluded.checkpoint_after_grade, checkpoint_url = excluded.checkpoint_url,
      track_type = excluded.track_type, assessment_mode = excluded.assessment_mode,
      grading_mode = excluded.grading_mode, locale = excluded.locale, source_package = excluded.source_package
  `);
  const insertTopic = db.prepare(`
    INSERT INTO learn_topics (subject_id, grade, slug, title, summary, sort_order)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(subject_id, grade, slug) DO NOTHING
  `);
  const linkGoal = db.prepare('INSERT OR IGNORE INTO learn_topic_goals (topic_id, goal_id) VALUES (?, ?)');
  const upsertCourseTopic = db.prepare(`
    INSERT INTO learn_course_topics (course_id, topic_id, position, prerequisite_topic_id, optional_challenge, estimated_minutes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(course_id, topic_id) DO UPDATE SET
      position = excluded.position, prerequisite_topic_id = excluded.prerequisite_topic_id,
      optional_challenge = excluded.optional_challenge, estimated_minutes = excluded.estimated_minutes
  `);
  const insertLesson = db.prepare(`
    INSERT INTO learn_lessons (
      topic_id, slug, sort_order, locale, version, title, body, practice, flashcards, authored_by,
      review_status, content_id, content_meta, open_prompts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
  `);
  const refreshLesson = db.prepare(`
    UPDATE learn_lessons SET title = @title, sort_order = @sort_order, locale = @locale, body = @body, practice = @practice,
      flashcards = @flashcards, open_prompts = @open_prompts, content_meta = @content_meta
    WHERE id = @id AND review_status = 'draft'
  `);
  const insertPaper = db.prepare(`
    INSERT INTO learn_review_papers (
      content_id, version, course_id, title, mode, duration_minutes, instructions, items, score_policy,
      source_lesson_ids, content_hash, review_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `);

  const idOf = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { id: number } | undefined)?.id;
  const pilotKeys = new Set(pilotGrade8Topics().map((topic) => `${topic.subject}:8:${topic.slug}`));

  const run = db.transaction(() => {
    const subjectIds = new Map<string, number>();
    const subjectTitles = new Map<string, string>();
    pkg.registry.subjects.forEach((subject) => {
      const index = SUBJECT_SLUGS.indexOf(subject.slug as typeof SUBJECT_SLUGS[number]);
      const locale = subject.slug === 'engelsk' ? 'en' : 'nb';
      summary.created.subjects += insertSubject.run(subject.slug, subject.title, subject.code, locale, index + 1).changes;
      const row = db.prepare('SELECT id, title FROM learn_subjects WHERE slug = ?').get(subject.slug) as { id: number; title: string };
      subjectIds.set(subject.slug, row.id);
      subjectTitles.set(subject.slug, row.title);

      for (const source of subject.official_stage_sources) {
        summary.created.goals += insertGoal.run(
          row.id, checkpointGoalKey(source.after_grade), `${subject.code} ${subject.stages[String(source.after_grade)]}`,
          source.after_grade, checkpointDescription(locale, subject.code, source.after_grade), source.url,
          curriculumRevisionFor(subject.code)
        ).changes;
      }
    });

    const lessons = new Map(pkg.subjects.flatMap((pack) => pack.lessons).map((lesson) => [lesson.id, lesson]));
    const sourceFileOf = (lesson: SourceLesson) => PACKAGE_FILES.subject(lesson.subject as typeof SUBJECT_SLUGS[number]);
    const tracks = new Map(pkg.registry.grade_subject_tracks.map((track) => [`${track.subject}:${track.grade}`, track]));
    const topicIds = new Map<string, number>();
    const courseIds = new Map<string, number>();

    for (const course of pkg.courseMap.courses) {
      const subjectId = subjectIds.get(course.subject)!;
      const track = tracks.get(`${course.subject}:${course.grade}`)!;
      const before = idOf('SELECT id FROM learn_courses WHERE course_key = ?', course.course_id);
      upsertCourse.run({
        course_key: course.course_id,
        subject_id: subjectId,
        grade: course.grade,
        title: course.title,
        curriculum_code: course.official_curriculum_code,
        checkpoint_after_grade: course.official_checkpoint_after_grade,
        checkpoint_url: course.source_url,
        track_type: course.track_type,
        assessment_mode: course.assessment_mode,
        grading_mode: track.grading_mode,
        locale: course.subject === 'engelsk' ? 'en' : 'nb',
        source_package: pkg.manifest.package
      });
      if (!before) summary.created.courses += 1;
      const courseId = idOf('SELECT id FROM learn_courses WHERE course_key = ?', course.course_id)!;
      courseIds.set(`${course.subject}:${course.grade}`, courseId);
      const goalId = idOf(
        'SELECT id FROM learn_goals WHERE subject_id = ? AND goal_key = ? AND curriculum_revision = ?',
        subjectId, checkpointGoalKey(course.official_checkpoint_after_grade), curriculumRevisionFor(course.official_curriculum_code)
      )!;

      for (const item of course.ordered_lessons) {
        const lesson = lessons.get(item.lesson_id)!;
        const topicKey = `${lesson.subject}:${lesson.grade}:${lesson.slug}`;
        const title = titleOf(lesson, pkg.grade8TopicMap).title;
        const created = insertTopic.run(subjectId, lesson.grade, lesson.slug, title, lesson.article.intro, lesson.sort_order).changes;
        summary.created.topics += created;
        if (!created && pilotKeys.has(topicKey)) summary.preserved_pilot_topics.push(topicKey);
        const topicId = idOf('SELECT id FROM learn_topics WHERE subject_id = ? AND grade = ? AND slug = ?', subjectId, lesson.grade, lesson.slug)!;
        topicIds.set(lesson.id, topicId);
        summary.created.topic_goals += linkGoal.run(topicId, goalId).changes;
      }

      for (const item of course.ordered_lessons) {
        const existed = idOf('SELECT id FROM learn_course_topics WHERE course_id = ? AND topic_id = ?', courseId, topicIds.get(item.lesson_id));
        upsertCourseTopic.run(
          courseId, topicIds.get(item.lesson_id), item.course_position,
          item.prerequisite_lesson_id ? topicIds.get(item.prerequisite_lesson_id) ?? null : null,
          item.optional_challenge ? 1 : 0, item.estimated_reading_minutes
        );
        if (!existed) summary.created.course_topics += 1;
      }
    }

    for (const lesson of lessons.values()) {
      const hash = contentHash(lesson);
      const stored = db.prepare('SELECT id, content_meta, review_status FROM learn_lessons WHERE content_id = ? AND version = ?')
        .get(lesson.id, lesson.version) as { id: number; content_meta: string; review_status: string } | undefined;
      const storedHash = stored ? JSON.parse(stored.content_meta || '{}')?.source?.content_hash : null;
      if (stored && storedHash === hash) {
        summary.unchanged.lessons += 1;
        continue;
      }
      if (stored && (stored.review_status !== 'draft' || isLessonInUse(stored.id))) {
        summary.skipped.push(
          `${lesson.id} v${lesson.version}: stored version differs from the package but is ${stored.review_status !== 'draft' ? stored.review_status : 'already used by a learner'}; publish changes as a new version`
        );
        continue;
      }

      const topicId = topicIds.get(lesson.id)!;
      const locale = uiLocaleOf(lesson);
      const collision = stored ? null : idOf('SELECT id FROM learn_lessons WHERE topic_id = ? AND slug = ? AND locale = ? AND version = ?', topicId, lesson.slug, locale, lesson.version);
      if (collision) {
        summary.skipped.push(`${lesson.id} v${lesson.version}: topic already has lesson ${collision} with this slug/version`);
        continue;
      }

      const courseItem = pkg.courseMap.courses
        .find((course) => course.subject === lesson.subject && course.grade === lesson.grade)!
        .ordered_lessons.find((item) => item.lesson_id === lesson.id)!;
      const title = titleOf(lesson, pkg.grade8TopicMap);
      const warnings = [
        ...(articleModelAnswerMatches(lesson) ? [] : ['article_model_answer_disagrees_with_practice_key']),
        ...(title.source === 'lesson' ? [] : [`title_missing_in_source_used_${title.source}`])
      ];
      const meta = {
        source: { package: pkg.manifest.package, file: sourceFileOf(lesson), content_id: lesson.id, content_hash: hash, imported_at: importedAt },
        title_source: title.source,
        curriculum: lesson.curriculum,
        assessment_mode: lesson.assessment_mode,
        local_domain: lesson.local_domain ?? null,
        editorial_status: lesson.editorial_status ?? null,
        source_locale: lesson.locale,
        estimated_minutes: courseItem.estimated_reading_minutes,
        content_warnings: warnings
      };

      if (stored) {
        // Unapproved and untouched by learners: safe to correct in place (still a draft afterwards)
        refreshLesson.run({
          id: stored.id, title: title.title, sort_order: lesson.sort_order, locale,
          body: JSON.stringify(toLessonBody(lesson)), practice: JSON.stringify(toPracticeItems(lesson)),
          flashcards: JSON.stringify(toFlashcards(lesson)), open_prompts: JSON.stringify(toOpenPrompts(lesson)),
          content_meta: JSON.stringify(meta)
        });
        // The topic row is shared by every version of the lesson, so correcting an
        // unapproved draft must not rewrite metadata a learner is already shown. Only
        // a topic with nothing reviewed in it can safely take the draft's wording.
        const topicHasReviewedLesson = db.prepare(
          "SELECT 1 FROM learn_lessons WHERE topic_id = ? AND review_status = 'reviewed' LIMIT 1"
        ).get(topicId);
        if (!pilotKeys.has(`${lesson.subject}:${lesson.grade}:${lesson.slug}`) && !topicHasReviewedLesson) {
          db.prepare('UPDATE learn_topics SET title = ?, summary = ? WHERE id = ?').run(title.title, lesson.article.intro, topicId);
        }
        summary.refreshed.lessons += 1;
        continue;
      }

      insertLesson.run(
        topicId, lesson.slug, lesson.sort_order, locale, lesson.version, title.title,
        JSON.stringify(toLessonBody(lesson)), JSON.stringify(toPracticeItems(lesson)), JSON.stringify(toFlashcards(lesson)),
        authoredBy, lesson.id, JSON.stringify(meta), JSON.stringify(toOpenPrompts(lesson))
      );
      summary.created.lessons += 1;
    }

    for (const paper of pkg.assessments.assessments) {
      const hash = contentHash(paper);
      const stored = db.prepare('SELECT id, content_hash, review_status FROM learn_review_papers WHERE content_id = ? AND version = ?')
        .get(paper.id, paper.version) as { id: number; content_hash: string; review_status: string } | undefined;
      const locale = paper.subject === 'engelsk' ? 'en' : 'nb';
      if (stored) {
        if (stored.content_hash === hash) {
          summary.unchanged.review_papers += 1;
        } else if (stored.review_status === 'draft' && !isPaperInUse(stored.id)) {
          db.prepare(`
            UPDATE learn_review_papers SET mode = ?, duration_minutes = ?, instructions = ?, items = ?, score_policy = ?,
              source_lesson_ids = ?, content_hash = ? WHERE id = ? AND review_status = 'draft'
          `).run(
            paper.mode, paper.duration_minutes, paper.instructions, JSON.stringify(paper.questions),
            JSON.stringify(paper.score_policy), JSON.stringify(paper.source_lesson_ids), hash, stored.id
          );
          summary.refreshed.review_papers += 1;
        } else {
          summary.skipped.push(
            `${paper.id} v${paper.version}: stored version differs from the package but is ${stored.review_status !== 'draft' ? stored.review_status : 'already used by a learner'}; publish changes as a new version`
          );
        }
        continue;
      }
      insertPaper.run(
        paper.id, paper.version, courseIds.get(`${paper.subject}:${paper.grade}`),
        paperTitle(locale, subjectTitles.get(paper.subject) || paper.subject, paper.grade),
        paper.mode, paper.duration_minutes, paper.instructions, JSON.stringify(paper.questions),
        JSON.stringify(paper.score_policy), JSON.stringify(paper.source_lesson_ids), hash
      );
      summary.created.review_papers += 1;
    }

    if (dryRun) {
      throw new DryRunRollback();
    }
  });

  try {
    run();
  } catch (error) {
    if (!(error instanceof DryRunRollback)) {
      validation.errors.push(`import aborted: ${(error as Error).message}`);
      return { ok: false, import_id: logImport('failed', summary), validation: { ...validation, ok: false }, summary };
    }
  }

  return { ok: true, import_id: logImport('ok', summary), validation, summary };
}

/** Startup hook: import the packaged library unless disabled; never throws. */
export function importPackagedLearnContent(dir?: string): ImportResult | null {
  if (process.env.LEARN_CONTENT_AUTO_IMPORT === 'false') {
    return null;
  }
  try {
    const pkg = loadContentPackage(dir || process.env.LEARN_CONTENT_DIR || undefined);
    const latest = db.prepare(`
      SELECT source_hash FROM learn_content_imports WHERE dry_run = 0 AND status = 'ok' ORDER BY id DESC LIMIT 1
    `).get() as { source_hash: string } | undefined;
    if (latest?.source_hash === pkg.sourceHash) {
      return null; // Already imported this exact package
    }
    const result = importContentPackage(pkg);
    if (result.ok) {
      const { created, unchanged, refreshed, skipped } = result.summary!;
      console.log(
        `📚 Learn content: ${created.lessons} new draft lessons, ${created.review_papers} new review papers, ` +
        `${refreshed.lessons + refreshed.review_papers} unused drafts corrected (${unchanged.lessons} lessons unchanged, ${skipped.length} skipped)`
      );
    } else {
      console.error('❌ Learn content import refused:', result.validation.errors.slice(0, 5).join(' | '));
    }
    return result;
  } catch (error: any) {
    console.error('Learn content import error:', error.message);
    return null;
  }
}
