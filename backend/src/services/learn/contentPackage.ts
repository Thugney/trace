import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * FamilyHub Learn research content package (Grades 1-10).
 *
 * Source of truth: docs/learn/ on the research branch. The backend image is
 * built from ./backend only, so an identical copy is packaged in
 * backend/content/learn (see scripts/sync-learn-content.ts; a test asserts
 * the two copies are byte-identical).
 *
 * This module only reads and validates. It never edits, completes or
 * generates educational content: anything missing is reported as an error or
 * a content gap and the importer refuses to load an invalid package.
 */

export const SUBJECT_SLUGS = ['matematikk', 'norsk', 'engelsk', 'naturfag', 'samfunnsfag'] as const;
export type SubjectSlug = typeof SUBJECT_SLUGS[number];
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

export const DEFAULT_CONTENT_DIR = path.resolve(__dirname, '../../../content/learn');

export const PACKAGE_FILES = {
  registry: 'lk20-source-registry-2026.json',
  courseMap: 'grade1-10-course-map-2026.json',
  grade8TopicMap: 'grade8-topic-map-2026.json',
  qaReport: 'research-qa-2026-10-24.json',
  manifest: 'content/library-manifest-2026.json',
  assessments: 'content/grade1-10-assessment-papers.json',
  subject: (slug: SubjectSlug) => `content/${slug}-grades1-10.json`
};

export const packageFileList = () => [
  PACKAGE_FILES.registry,
  PACKAGE_FILES.courseMap,
  PACKAGE_FILES.grade8TopicMap,
  PACKAGE_FILES.qaReport,
  PACKAGE_FILES.manifest,
  PACKAGE_FILES.assessments,
  ...SUBJECT_SLUGS.map(PACKAGE_FILES.subject)
];

// ---------------------------------------------------------------- source shapes

export type SourceOption = { key: string; label: string };

export type SourceLesson = {
  id: string;
  subject: string;
  grade: number;
  slug: string;
  sort_order: number;
  version: number;
  review_status: string;
  editorial_status?: string;
  locale: string;
  // Missing on every English lesson in the 2026-10-24 package (reported as a content gap)
  title?: string;
  curriculum: {
    code: string;
    official_checkpoint_after_grade: number;
    competence_goal_source_url: string;
    lesson_specific_goal_crosswalk: string;
    topic_sequence_type: string;
  };
  article: {
    intro: string;
    sections: { heading: string; text: string }[];
    comprehension_check: string;
    model_answer: string;
    key_takeaway: string;
    worked_example: string | { explanation: string; result?: string };
  };
  practice: [
    {
      id: string;
      type: 'single_select';
      question: string;
      options: SourceOption[];
      correct_key: string;
      correct_answer: string;
      explanation: string;
      review_status?: string;
    },
    {
      id: string;
      type: 'open_response';
      question: string;
      model_answer: string;
      grading: string;
      requires_human_review: boolean;
    }
  ];
  flashcards: { front: string; back: string }[];
  existing_grade8_slug_preserved: boolean;
  assessment_mode: string;
  local_domain?: string;
};

export type SourceSubjectPack = {
  schema_version: string;
  subject: string;
  grades: number[];
  curriculum_code: string;
  review_status: string;
  lessons: SourceLesson[];
};

export type SourceRegistry = {
  schema_version: string;
  subjects: {
    slug: string;
    title: string;
    code: string;
    lang: string;
    stages: Record<string, string>;
    official_stage_sources: { after_grade: number; url: string }[];
    curriculum_home_url?: string;
  }[];
  grade_subject_tracks: {
    grade: number;
    subject: string;
    official_curriculum_code: string;
    official_goal_checkpoint_after_grade: number;
    checkpoint_is_this_grade: boolean;
    official_goal_page_url: string;
    year_plan_type: string;
    grading_mode: string;
    locale: string;
  }[];
};

export type SourceCourse = {
  course_id: string;
  grade: number;
  subject: string;
  title: string;
  official_curriculum_code: string;
  official_checkpoint_after_grade: number;
  source_url: string;
  track_type: string;
  assessment_mode: string;
  ordered_lessons: {
    lesson_id: string;
    slug: string;
    title: string;
    course_position: number;
    prerequisite_lesson_id: string | null;
    optional_challenge: boolean;
    estimated_reading_minutes: number;
    content_version: number;
    review_status: string;
  }[];
};

export type SourceCourseMap = {
  schema_version: string;
  course_count: number;
  lesson_count: number;
  courses: SourceCourse[];
};

export type SourcePaperQuestion =
  | {
      id: string;
      source_lesson_id: string;
      kind: 'single_select';
      prompt: string;
      options: SourceOption[];
      correct_key: string;
      correct_answer: string;
      points: number;
      criterion: string;
      explanation: string;
    }
  | {
      id: string;
      source_lesson_id: string;
      kind: 'open_response';
      prompt: string;
      expected_content: string;
      points: number;
      criterion: string;
      requires_human_review: boolean;
    };

export type SourcePaper = {
  id: string;
  subject: string;
  grade: number;
  source_lesson_ids: string[];
  version: number;
  review_status: string;
  mode: string;
  duration_minutes: number;
  curriculum_code: string;
  checkpoint_after_grade: number;
  instructions: string;
  questions: SourcePaperQuestion[];
  score_policy: {
    objective_items: number;
    subjective_items: number;
    max_raw_points: number;
    authoritative_udir_grading_scheme: boolean;
    numeric_grade_allowed: boolean;
    reason: string;
    learner_feedback: string[];
  };
};

export type SourceAssessments = { schema_version: string; review_status: string; assessments: SourcePaper[] };

export type SourceGrade8TopicMap = {
  topics: { grade: number; subject: string; slug: string; title: string; preserve_existing_pilot_slug: boolean }[];
};

export type SourceManifest = {
  package: string;
  prepared_on: string;
  subject_files: { subject: string; path: string; count: number }[];
  statistics: Record<string, number>;
};

export type ContentPackage = {
  dir: string;
  sourceHash: string;
  manifest: SourceManifest;
  registry: SourceRegistry;
  courseMap: SourceCourseMap;
  grade8TopicMap: SourceGrade8TopicMap;
  assessments: SourceAssessments;
  subjects: SourceSubjectPack[];
};

export type ValidationReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    subjects: number;
    grades: number;
    grade_subject_groups: number;
    courses: number;
    lessons: number;
    untitled_lessons: number;
    practice_prompts: number;
    objective_items: number;
    open_responses: number;
    flashcards: number;
    review_papers: number;
    review_paper_items: number;
    checkpoint_pages: number;
    answer_key_distribution: Record<string, number>;
    article_model_answer_mismatches: number;
  };
};

// ---------------------------------------------------------------- loading

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const readJson = (dir: string, relative: string) => {
  const file = path.join(dir, relative);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

export function hashPackageFiles(dir: string): string {
  const hash = crypto.createHash('sha256');
  for (const relative of packageFileList()) {
    hash.update(relative);
    hash.update(fs.readFileSync(path.join(dir, relative)));
  }
  return hash.digest('hex');
}

export function loadContentPackage(dir: string = DEFAULT_CONTENT_DIR): ContentPackage {
  return {
    dir,
    sourceHash: hashPackageFiles(dir),
    manifest: readJson(dir, PACKAGE_FILES.manifest),
    registry: readJson(dir, PACKAGE_FILES.registry),
    courseMap: readJson(dir, PACKAGE_FILES.courseMap),
    grade8TopicMap: readJson(dir, PACKAGE_FILES.grade8TopicMap),
    assessments: readJson(dir, PACKAGE_FILES.assessments),
    subjects: SUBJECT_SLUGS.map((slug) => readJson(dir, PACKAGE_FILES.subject(slug)))
  };
}

// ---------------------------------------------------------------- helpers shared with the importer

export const contentHash = (value: unknown) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const workedExampleOf = (lesson: SourceLesson) => {
  const example = lesson.article.worked_example;
  return typeof example === 'string' ? { explanation: example, result: '' } : { explanation: example.explanation, result: example.result || '' };
};

/** UI language of a lesson: English packs (with or without Bokmål scaffolding) render in English. */
export const uiLocaleOf = (lesson: SourceLesson): 'nb' | 'en' => (lesson.locale.startsWith('en') ? 'en' : 'nb');

/** Official checkpoint stage for a grade: the first published stage at or after it. */
export function checkpointForGrade(registrySubject: SourceRegistry['subjects'][number], grade: number): number | null {
  const stages = Object.keys(registrySubject.stages).map(Number).sort((a, b) => a - b);
  return stages.find((stage) => stage >= grade) ?? null;
}

/**
 * Display title. The English pack has no titles, so fall back to supplied data in
 * order: the grade 8 topic map, then the slug's own words. The fallback is flagged
 * (title_source) so a reviewer confirms it; no title is invented.
 */
export function titleOf(lesson: SourceLesson, grade8TopicMap?: SourceGrade8TopicMap): { title: string; source: 'lesson' | 'grade8_topic_map' | 'slug' } {
  if (isNonEmptyString(lesson.title)) return { title: lesson.title, source: 'lesson' };
  const mapped = grade8TopicMap?.topics.find((topic) => topic.grade === lesson.grade && topic.subject === lesson.subject && topic.slug === lesson.slug);
  if (mapped && isNonEmptyString(mapped.title)) return { title: mapped.title, source: 'grade8_topic_map' };
  const words = lesson.slug.replace(/-/g, ' ');
  return { title: words.charAt(0).toUpperCase() + words.slice(1), source: 'slug' };
}

/** The course map and lesson packs name the grade 8-10 mode differently; both mean the same policy. */
export const GRADE8_10_ASSESSMENT_MODES = ['formative_plus_non_official_mock_assessment', 'formative_with_optional_indicative_review_later'];
const isAssessmentModeFor = (grade: number, mode: string) =>
  grade <= 7 ? mode === 'formative_only' : GRADE8_10_ASSESSMENT_MODES.includes(mode);

export function articleModelAnswerMatches(lesson: SourceLesson): boolean {
  const modelAnswer = String(lesson.article.model_answer ?? '').trim();
  const question = lesson.practice[0];
  return modelAnswer === question.correct_key || modelAnswer.toLowerCase() === String(question.correct_answer).trim().toLowerCase();
}

// ---------------------------------------------------------------- validation

export function validateContentPackage(pkg: ContentPackage, options: { existingGrade8PilotTopics?: Array<{ subject: string; slug: string }> } = {}): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const keyDistribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  let flashcards = 0;
  let modelAnswerMismatches = 0;
  const modelAnswerMismatchIds: string[] = [];
  const untitled: string[] = [];
  const preserveFlagMismatches: string[] = [];

  const registrySubjects = new Map(pkg.registry.subjects.map((subject) => [subject.slug, subject]));
  const lessonsById = new Map<string, SourceLesson>();

  // Registry: 5 curricula, one track per grade x subject, stage URLs consistent
  if (pkg.registry.subjects.length !== SUBJECT_SLUGS.length) {
    errors.push(`registry: expected ${SUBJECT_SLUGS.length} subjects, found ${pkg.registry.subjects.length}`);
  }
  let checkpointPages = 0;
  for (const slug of SUBJECT_SLUGS) {
    const subject = registrySubjects.get(slug);
    if (!subject) {
      errors.push(`registry: subject ${slug} missing`);
      continue;
    }
    for (const [afterGrade, locator] of Object.entries(subject.stages)) {
      checkpointPages += 1;
      const source = subject.official_stage_sources.find((item) => item.after_grade === Number(afterGrade));
      if (!source || !/^https:\/\/www\.udir\.no\/lk20\//.test(source.url) || !source.url.includes(`/${locator}`)) {
        errors.push(`registry: ${slug} stage ${afterGrade} (${locator}) has no matching official Udir URL`);
      }
    }
    if (checkpointForGrade(subject, 10) !== 10) {
      errors.push(`registry: ${slug} has no checkpoint after grade 10`);
    }
  }
  const tracks = new Map(pkg.registry.grade_subject_tracks.map((track) => [`${track.subject}:${track.grade}`, track]));
  if (tracks.size !== SUBJECT_SLUGS.length * GRADES.length) {
    errors.push(`registry: expected ${SUBJECT_SLUGS.length * GRADES.length} grade/subject tracks, found ${tracks.size}`);
  }

  // Subject packs: 50 lessons each, 5 per grade, complete micro-lesson schema
  const seenIdentity = new Set<string>();
  pkg.subjects.forEach((pack, index) => {
    const slug = SUBJECT_SLUGS[index];
    const registrySubject = registrySubjects.get(slug);
    if (pack.schema_version !== '2.0.0') errors.push(`${slug}: unsupported schema_version ${pack.schema_version}`);
    if (pack.subject !== slug) errors.push(`${slug}: pack declares subject ${pack.subject}`);
    if (registrySubject && pack.curriculum_code !== registrySubject.code) {
      errors.push(`${slug}: curriculum_code ${pack.curriculum_code} does not match registry ${registrySubject.code}`);
    }
    if (!Array.isArray(pack.lessons) || pack.lessons.length !== 50) {
      errors.push(`${slug}: expected 50 lessons, found ${pack.lessons?.length ?? 0}`);
      return;
    }

    const slotsInSubject = new Set<string>();
    for (const grade of GRADES) {
      const lessons = pack.lessons.filter((lesson) => lesson.grade === grade);
      if (lessons.length !== 5) errors.push(`${slug} grade ${grade}: expected 5 lessons, found ${lessons.length}`);
      const orders = lessons.map((lesson) => lesson.sort_order).sort((a, b) => a - b).join(',');
      if (orders !== '1,2,3,4,5') errors.push(`${slug} grade ${grade}: sort_order must be 1-5, found ${orders}`);
    }

    for (const lesson of pack.lessons) {
      const where = `lesson ${lesson.id}`;
      if (lesson.id !== `${slug}-g${lesson.grade}-${lesson.slug}`) errors.push(`${where}: id does not follow <subject>-g<grade>-<slug>`);
      if (lessonsById.has(lesson.id)) errors.push(`${where}: duplicate id`);
      lessonsById.set(lesson.id, lesson);
      const identity = `${lesson.subject}:${lesson.grade}:${lesson.slug}:${lesson.version}`;
      if (seenIdentity.has(identity)) errors.push(`${where}: duplicate (subject, grade, slug, version)`);
      seenIdentity.add(identity);

      if (lesson.subject !== slug) errors.push(`${where}: subject ${lesson.subject} in ${slug} pack`);
      if (!GRADES.includes(lesson.grade as typeof GRADES[number])) errors.push(`${where}: grade ${lesson.grade} out of range`);
      if (!Number.isInteger(lesson.version) || lesson.version < 1) errors.push(`${where}: invalid version`);
      // The importer only ever ingests drafts; approval happens in FamilyHub
      if (lesson.review_status !== 'draft') errors.push(`${where}: review_status must be draft, found ${lesson.review_status}`);
      if (!/^[a-z0-9-]+$/.test(lesson.slug)) errors.push(`${where}: slug invalid`);
      if (!isNonEmptyString(lesson.title)) untitled.push(lesson.id);
      if (!['nb', 'en', 'en-with-nb-scaffolding'].includes(lesson.locale)) errors.push(`${where}: unsupported locale ${lesson.locale}`);

      // Curriculum stage must agree with the versioned registry; no individual goal IDs
      const curriculum = lesson.curriculum;
      const track = tracks.get(`${slug}:${lesson.grade}`);
      const expectedCheckpoint = registrySubject ? checkpointForGrade(registrySubject, lesson.grade) : null;
      const expectedUrl = registrySubject?.official_stage_sources.find((source) => source.after_grade === expectedCheckpoint)?.url;
      if (!curriculum || curriculum.code !== registrySubject?.code) errors.push(`${where}: curriculum code mismatch`);
      if (curriculum?.official_checkpoint_after_grade !== expectedCheckpoint) {
        errors.push(`${where}: checkpoint ${curriculum?.official_checkpoint_after_grade} but registry stage is ${expectedCheckpoint}`);
      }
      if (curriculum?.competence_goal_source_url !== expectedUrl) errors.push(`${where}: checkpoint URL does not match registry`);
      if (track && (track.official_goal_checkpoint_after_grade !== expectedCheckpoint || track.official_goal_page_url !== expectedUrl)) {
        errors.push(`${where}: registry track disagrees with registry stages`);
      }
      if (curriculum?.lesson_specific_goal_crosswalk !== 'unverified') {
        errors.push(`${where}: individual goal crosswalk must stay unverified until a reviewer confirms it`);
      }
      const expectedSequence = expectedCheckpoint === lesson.grade ? 'local_sequence_at_checkpoint' : 'local_sequence_toward_checkpoint';
      if (curriculum?.topic_sequence_type !== expectedSequence) errors.push(`${where}: topic_sequence_type should be ${expectedSequence}`);

      if (!isAssessmentModeFor(lesson.grade, lesson.assessment_mode)) errors.push(`${where}: assessment_mode ${lesson.assessment_mode} is not allowed for grade ${lesson.grade}`);

      // Article
      const article = lesson.article;
      if (!article || !isNonEmptyString(article.intro) || !isNonEmptyString(article.key_takeaway) || !isNonEmptyString(article.comprehension_check)) {
        errors.push(`${where}: article intro/key_takeaway/comprehension_check missing`);
      }
      if (!Array.isArray(article?.sections) || article.sections.length === 0
        || article.sections.some((section) => !isNonEmptyString(section.heading) || !isNonEmptyString(section.text))) {
        errors.push(`${where}: article sections need heading and text`);
      }
      if (!article?.worked_example || !isNonEmptyString(workedExampleOf(lesson).explanation)) errors.push(`${where}: worked_example missing`);

      // Practice: one keyed single-select and one human-reviewed open response
      const [objective, open] = lesson.practice || [];
      if (!Array.isArray(lesson.practice) || lesson.practice.length !== 2) errors.push(`${where}: expected 2 practice prompts`);
      if (!objective || objective.type !== 'single_select') {
        errors.push(`${where}: practice[0] must be single_select`);
      } else {
        const keys = objective.options.map((option) => option.key);
        const labels = objective.options.map((option) => String(option.label).trim().toLowerCase());
        if (keys.join('') !== OPTION_KEYS.join('')) errors.push(`${where}: options must be keyed A-D`);
        if (new Set(labels).size !== 4 || labels.some((label) => !label)) errors.push(`${where}: options must be four distinct labels`);
        const correct = objective.options.find((option) => option.key === objective.correct_key);
        if (!correct) errors.push(`${where}: correct_key ${objective.correct_key} is not an option`);
        else if (String(correct.label) !== String(objective.correct_answer)) errors.push(`${where}: correct_answer does not match the keyed option`);
        if (!isNonEmptyString(objective.question) || !isNonEmptyString(objective.explanation)) errors.push(`${where}: question/explanation missing`);
        if (objective.id !== `${lesson.id}-q1`) errors.push(`${where}: practice[0] id should be ${lesson.id}-q1`);
        if (keyDistribution[objective.correct_key] !== undefined) keyDistribution[objective.correct_key] += 1;
        slotsInSubject.add(objective.correct_key);
      }
      if (!open || open.type !== 'open_response' || open.grading !== 'human_feedback_required' || open.requires_human_review !== true) {
        errors.push(`${where}: practice[1] must be an open_response requiring human feedback`);
      } else if (!isNonEmptyString(open.question) || !isNonEmptyString(open.model_answer)) {
        errors.push(`${where}: open response question/model_answer missing`);
      }

      if (!Array.isArray(lesson.flashcards) || lesson.flashcards.length !== 3
        || lesson.flashcards.some((card) => !isNonEmptyString(card.front) || !isNonEmptyString(card.back))) {
        errors.push(`${where}: expected 3 complete flashcards`);
      } else {
        flashcards += lesson.flashcards.length;
      }

      if (objective && !articleModelAnswerMatches(lesson)) {
        modelAnswerMismatches += 1;
        modelAnswerMismatchIds.push(lesson.id);
      }
    }

    if (slotsInSubject.size < 2) errors.push(`${slug}: every answer key is in the same option slot`);
  });

  if (untitled.length > 0) {
    warnings.push(
      `content: ${untitled.length} lessons have no title (e.g. ${untitled.slice(0, 3).join(', ')}). ` +
      'The display title is taken from the grade 8 topic map or the slug and flagged for reviewer confirmation.'
    );
  }

  if (modelAnswerMismatches > 0) {
    warnings.push(
      `content: ${modelAnswerMismatches} lessons have article.model_answer that disagrees with practice[0].correct_key/correct_answer ` +
      `(e.g. ${modelAnswerMismatchIds.slice(0, 3).join(', ')}). The keyed practice answer is used; article.model_answer is not shown to learners. ` +
      'Needs editorial correction.'
    );
  }

  // Course map: 50 sequences referencing the 250 lesson IDs
  const courses = pkg.courseMap.courses || [];
  if (courses.length !== 50) errors.push(`course map: expected 50 courses, found ${courses.length}`);
  const courseKeys = new Set<string>();
  const coveredLessons = new Set<string>();
  for (const course of courses) {
    const where = `course ${course.course_id}`;
    if (courseKeys.has(`${course.subject}:${course.grade}`)) errors.push(`${where}: duplicate grade/subject`);
    courseKeys.add(`${course.subject}:${course.grade}`);
    const registrySubject = registrySubjects.get(course.subject);
    const expectedCheckpoint = registrySubject ? checkpointForGrade(registrySubject, course.grade) : null;
    if (course.official_curriculum_code !== registrySubject?.code || course.official_checkpoint_after_grade !== expectedCheckpoint) {
      errors.push(`${where}: curriculum code/checkpoint disagrees with registry`);
    }
    if (course.ordered_lessons.length !== 5) errors.push(`${where}: expected 5 ordered lessons`);
    const ids = new Set(course.ordered_lessons.map((item) => item.lesson_id));
    course.ordered_lessons.forEach((item, index) => {
      const lesson = lessonsById.get(item.lesson_id);
      if (!lesson) {
        errors.push(`${where}: unknown lesson ${item.lesson_id}`);
        return;
      }
      coveredLessons.add(item.lesson_id);
      if (lesson.subject !== course.subject || lesson.grade !== course.grade) errors.push(`${where}: ${item.lesson_id} belongs to another grade/subject`);
      if (item.course_position !== index + 1) errors.push(`${where}: positions must be sequential`);
      if (item.content_version !== lesson.version) errors.push(`${where}: ${item.lesson_id} version mismatch`);
      if (item.prerequisite_lesson_id && !ids.has(item.prerequisite_lesson_id)) errors.push(`${where}: prerequisite outside the course`);
    });
    if (!isAssessmentModeFor(course.grade, course.assessment_mode)) errors.push(`${where}: assessment_mode ${course.assessment_mode} is not allowed for grade ${course.grade}`);
  }
  if (coveredLessons.size !== lessonsById.size) errors.push(`course map covers ${coveredLessons.size} of ${lessonsById.size} lessons`);

  // Review papers: 50 formative papers, items synchronized with lesson answer keys
  const papers = pkg.assessments.assessments || [];
  if (papers.length !== 50) errors.push(`assessments: expected 50 review papers, found ${papers.length}`);
  let paperItems = 0;
  const paperIds = new Set<string>();
  for (const paper of papers) {
    const where = `paper ${paper.id}`;
    if (paperIds.has(paper.id)) errors.push(`${where}: duplicate id`);
    paperIds.add(paper.id);
    if (paper.review_status !== 'draft') errors.push(`${where}: review_status must be draft`);
    // A short uncalibrated paper may never produce a numerical grade
    if (paper.score_policy?.numeric_grade_allowed !== false) errors.push(`${where}: numeric grades are not allowed for review papers`);
    const course = courses.find((item) => item.subject === paper.subject && item.grade === paper.grade);
    const expectedLessons = course?.ordered_lessons.map((item) => item.lesson_id).sort().join(',');
    if ([...paper.source_lesson_ids].sort().join(',') !== expectedLessons) errors.push(`${where}: source lessons differ from the course`);
    if (!Array.isArray(paper.questions) || paper.questions.length !== 10) errors.push(`${where}: expected 10 questions`);
    if (!(paper.duration_minutes > 0)) errors.push(`${where}: duration missing`);
    for (const question of paper.questions || []) {
      paperItems += 1;
      const lesson = lessonsById.get(question.source_lesson_id);
      if (!lesson || !paper.source_lesson_ids.includes(question.source_lesson_id)) {
        errors.push(`${where}: ${question.id} references an unknown lesson`);
        continue;
      }
      if (question.kind === 'single_select') {
        const objective = lesson.practice[0];
        if (question.prompt !== objective.question || question.correct_key !== objective.correct_key
          || question.correct_answer !== objective.correct_answer
          || JSON.stringify(question.options) !== JSON.stringify(objective.options)) {
          errors.push(`${where}: ${question.id} answer key is not synchronized with lesson ${lesson.id}`);
        }
      } else if (question.kind === 'open_response') {
        if (question.requires_human_review !== true || !isNonEmptyString(question.expected_content)) {
          errors.push(`${where}: ${question.id} must require human review`);
        }
      } else {
        errors.push(`${where}: unsupported question kind`);
      }
    }
  }

  // Grade 8 topic map: the five pilot slugs are preserved; the other 20 are new
  const grade8Topics = pkg.grade8TopicMap.topics || [];
  for (const topic of grade8Topics) {
    const lesson = lessonsById.get(`${topic.subject}-g8-${topic.slug}`);
    if (!lesson) {
      errors.push(`grade 8 topic map: ${topic.subject}/${topic.slug} has no lesson`);
    } else if (lesson.existing_grade8_slug_preserved !== topic.preserve_existing_pilot_slug) {
      // The topic map is authoritative: only its five flagged slugs are existing PR #9 topics
      preserveFlagMismatches.push(lesson.id);
    }
  }
  if (options.existingGrade8PilotTopics) {
    const preserved = grade8Topics.filter((topic) => topic.preserve_existing_pilot_slug).map((topic) => `${topic.subject}/${topic.slug}`).sort();
    const existing = options.existingGrade8PilotTopics.map((topic) => `${topic.subject}/${topic.slug}`).sort();
    if (preserved.join(',') !== existing.join(',')) {
      errors.push(`grade 8 topic map: preserved slugs [${preserved.join(', ')}] do not match the PR #9 pilot [${existing.join(', ')}]`);
    }
  }

  if (preserveFlagMismatches.length > 0) {
    warnings.push(
      `content: ${preserveFlagMismatches.length} grade 8 lessons set existing_grade8_slug_preserved but the topic map marks them as new ` +
      `(e.g. ${preserveFlagMismatches.slice(0, 3).join(', ')}). The topic map is used.`
    );
  }
  const courseModes = new Set(courses.filter((course) => course.grade >= 8).map((course) => course.assessment_mode));
  const lessonModes = new Set([...lessonsById.values()].filter((lesson) => lesson.grade >= 8).map((lesson) => lesson.assessment_mode));
  if ([...courseModes].some((mode) => !lessonModes.has(mode))) {
    warnings.push(
      `content: grade 8-10 assessment_mode is "${[...courseModes].join(', ')}" in the course map but "${[...lessonModes].join(', ')}" ` +
      'in the lessons; both are treated as formative practice with non-official results.'
    );
  }

  // Manifest inventory must describe exactly this package
  const stats = pkg.manifest.statistics || {};
  const expectations: Array<[string, number]> = [
    ['micro_lessons', lessonsById.size],
    ['flashcards', flashcards],
    ['subject_review_papers', papers.length],
    ['review_paper_questions', paperItems],
    ['official_goal_stage_pages', checkpointPages],
    ['grade_subject_units', courses.length]
  ];
  for (const [key, actual] of expectations) {
    if (stats[key] !== actual) errors.push(`manifest: statistics.${key} is ${stats[key]}, package contains ${actual}`);
  }
  if (stats.published_lessons !== 0) errors.push('manifest: package claims published lessons; only drafts are importable');

  for (const [slot, count] of Object.entries(keyDistribution)) {
    if (count > lessonsById.size * 0.5) warnings.push(`answer keys: ${count} of ${lessonsById.size} are option ${slot}`);
  }

  const practicePrompts = [...lessonsById.values()].reduce((sum, lesson) => sum + (lesson.practice?.length || 0), 0);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      subjects: pkg.subjects.length,
      grades: new Set([...lessonsById.values()].map((lesson) => lesson.grade)).size,
      grade_subject_groups: courseKeys.size,
      courses: courses.length,
      lessons: lessonsById.size,
      untitled_lessons: untitled.length,
      practice_prompts: practicePrompts,
      objective_items: [...lessonsById.values()].filter((lesson) => lesson.practice?.[0]?.type === 'single_select').length,
      open_responses: [...lessonsById.values()].filter((lesson) => lesson.practice?.[1]?.type === 'open_response').length,
      flashcards,
      review_papers: papers.length,
      review_paper_items: paperItems,
      checkpoint_pages: checkpointPages,
      answer_key_distribution: keyDistribution,
      article_model_answer_mismatches: modelAnswerMismatches
    }
  };
}
