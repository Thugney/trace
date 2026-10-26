import { describe, it, expect } from 'vitest';
import { GRADE8_PILOT } from '../services/learn/curriculum.js';
import { normalizeAnswer, scoreMockExam } from '../services/learn/mockScoring.js';

describe('grade 8 pilot content integrity', () => {
  it('covers the five initial subjects with one grade-8 topic each', () => {
    expect(GRADE8_PILOT.map((subject) => subject.udirCode)).toEqual(['MAT01-05', 'NOR01-06', 'ENG01-04', 'NAT01-04', 'SAF01-04']);
    expect(GRADE8_PILOT.every((subject) => subject.topic.grade === 8)).toBe(true);
  });

  it('maps only declared goals, links Udir sources and marks paraphrases', () => {
    for (const subject of GRADE8_PILOT) {
      const goalKeys = subject.goals.map((goal) => goal.key);
      expect(subject.topic.goalKeys.every((key) => goalKeys.includes(key))).toBe(true);
      expect(subject.sourceUrl).toMatch(/^https:\/\/www\.udir\.no\/lk20\/[a-z]{3}0\d-0\d$/);
      // Only Mathematics publishes goals after grade 8
      for (const goal of subject.goals) {
        expect(goal.goalAfterGrade).toBe(subject.slug === 'matematikk' ? 8 : 10);
      }
    }
  });

  it('has valid practice answer keys for the activity engine', () => {
    for (const subject of GRADE8_PILOT) {
      const { practice, flashcards, body } = subject.topic.lesson;
      expect(practice.length).toBeGreaterThanOrEqual(4);
      expect(flashcards.length).toBeGreaterThanOrEqual(5);
      expect(body.workedExamples.length).toBeGreaterThanOrEqual(2);
      expect(new Set(practice.map((item) => item.key)).size).toBe(practice.length);
      expect(new Set(flashcards.map((card) => card.key)).size).toBe(flashcards.length);

      for (const item of practice) {
        if (item.type === 'multiple_choice') {
          expect(item.content.options.map((option) => option.id)).toContain(item.correct.correctAnswer);
        } else {
          const blanks = item.content.sentences.join(' ').match(/___/g)?.length || 0;
          expect(blanks).toBe(item.correct.blanks.length);
        }
      }
    }
  });

  it('has mock exams whose rubric criteria are covered and answer keys are valid', () => {
    for (const subject of GRADE8_PILOT) {
      const { items, rubric } = subject.topic.mockExam;
      for (const criterion of rubric.criteria) {
        expect(items.filter((item) => item.criterion === criterion.key).length).toBeGreaterThanOrEqual(rubric.minItemsAnsweredPerCriterion);
      }
      for (const item of items) {
        expect(rubric.criteria.map((criterion) => criterion.key)).toContain(item.criterion);
        if (item.type === 'multiple_choice') {
          expect(item.options?.map((option) => option.id)).toContain(item.answer);
        }
      }

      // All-correct responses must score full marks
      const all = scoreMockExam(items, rubric, Object.fromEntries(items.map((item) => [item.key, item.answer])));
      expect(all.percent).toBe(100);
      expect(all.indicativeGrade).toBe(6);
      expect(rubric.disclaimer.length).toBeGreaterThan(20);
    }
  });
});

describe('mock exam scoring', () => {
  const { items, rubric } = GRADE8_PILOT[0].topic.mockExam;
  const allCorrect = Object.fromEntries(items.map((item) => [item.key, item.answer]));

  it('normalizes equivalent notations', () => {
    expect(normalizeAnswer(' 2 x 2 x 3 x 7 ')).toBe(normalizeAnswer('2·2·3·7'));
    expect(normalizeAnswer('2²·3·7')).toBe(normalizeAnswer('2^2·3·7'));
    expect(normalizeAnswer('Motargument.')).toBe('motargument');
  });

  it('maps percentages to the deterministic grade bands', () => {
    const wrongKeys = (count: number) => {
      const responses: Record<string, string> = { ...allCorrect };
      items.slice(0, count).forEach((item) => { responses[item.key] = 'feil'; });
      return scoreMockExam(items, rubric, responses);
    };
    expect(wrongKeys(0).indicativeGrade).toBe(6);
    expect(wrongKeys(2).percent).toBe(78);
    expect(wrongKeys(2).indicativeGrade).toBe(5);
    expect(wrongKeys(4).indicativeGrade).toBe(4);
    expect(wrongKeys(9).indicativeGrade).toBe(1);
  });

  it('withholds a grade when a criterion lacks evidence even if the overall ratio is fine', () => {
    const responses: Record<string, string> = { ...allCorrect };
    // Leave two of three items in one criterion unanswered (7/9 answered = 0.78 < 0.8 too)
    delete responses.b1;
    delete responses.b2;
    const result = scoreMockExam(items, rubric, responses);
    expect(result.outcome).toBe('insufficient_evidence');
    expect(result.indicativeGrade).toBeNull();
    expect(result.insufficientReasons).toContain('criterion_not_covered:brokregning');
  });

  it('suggests next steps for weak criteria', () => {
    const responses: Record<string, string> = { ...allCorrect, b1: 'x', b2: 'x', b3: 'x' };
    const result = scoreMockExam(items, rubric, responses);
    expect(result.outcome).toBe('graded');
    expect(result.nextSteps[0]).toMatch(/^Brøkregning/);
  });
});
