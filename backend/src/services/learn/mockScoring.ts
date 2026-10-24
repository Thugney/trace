import type { MockExamItem, MockExamRubric } from './curriculum';

/**
 * Deterministic, server-side scoring for Learn mock exams.
 *
 * The indicative 1-6 grade is only produced when the rubric's evidence rules
 * are met (enough items answered overall and per criterion). Otherwise the
 * outcome is `insufficient_evidence` and no grade is shown. The estimate is
 * never an official grade or a standpunktkarakter prediction.
 */

export type MockResponses = Record<string, string | undefined | null>;

export type MockItemResult = {
  key: string;
  criterion: string;
  answered: boolean;
  correct: boolean;
  pointsEarned: number;
  pointsPossible: number;
  correctAnswer: string;
  explanation: string;
};

export type MockCriterionResult = {
  key: string;
  label: string;
  description: string;
  pointsEarned: number;
  pointsPossible: number;
  answered: number;
  total: number;
  percent: number;
};

export type MockScoringResult = {
  score: number;
  maxScore: number;
  percent: number;
  answeredRatio: number;
  outcome: 'graded' | 'insufficient_evidence';
  indicativeGrade: number | null;
  insufficientReasons: string[];
  criteria: MockCriterionResult[];
  items: MockItemResult[];
  nextSteps: string[];
  limitations: string[];
  disclaimer: string;
};

const MAX_RESPONSE_LENGTH = 200;

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFC')
    .replace(/[²]/g, '^2')
    .replace(/(\d)\s*[x×*]\s*(?=\d)/g, '$1·')
    .replace(/\s+/g, '')
    .replace(/[.!]+$/, '')
    .trim();
}

function isAnswered(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function scoreMockExam(items: MockExamItem[], rubric: MockExamRubric, responses: MockResponses): MockScoringResult {
  const itemResults: MockItemResult[] = items.map((item) => {
    const raw = responses[item.key];
    const answered = isAnswered(raw);
    const candidate = answered ? String(raw).slice(0, MAX_RESPONSE_LENGTH) : '';

    let correct = false;
    if (answered) {
      if (item.type === 'multiple_choice') {
        correct = candidate === item.answer;
      } else {
        const accepted = [item.answer, ...(item.acceptAlternatives || [])].map(normalizeAnswer);
        correct = accepted.includes(normalizeAnswer(candidate));
      }
    }

    const correctOption = item.type === 'multiple_choice'
      ? item.options?.find((option) => option.id === item.answer)?.text || item.answer
      : item.answer;

    return {
      key: item.key,
      criterion: item.criterion,
      answered,
      correct,
      pointsEarned: correct ? item.points : 0,
      pointsPossible: item.points,
      correctAnswer: correctOption,
      explanation: item.explanation
    };
  });

  const criteria: MockCriterionResult[] = rubric.criteria.map((criterion) => {
    const results = itemResults.filter((result) => result.criterion === criterion.key);
    const pointsEarned = results.reduce((sum, result) => sum + result.pointsEarned, 0);
    const pointsPossible = results.reduce((sum, result) => sum + result.pointsPossible, 0);
    return {
      key: criterion.key,
      label: criterion.label,
      description: criterion.description,
      pointsEarned,
      pointsPossible,
      answered: results.filter((result) => result.answered).length,
      total: results.length,
      percent: pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 100) : 0
    };
  });

  const score = itemResults.reduce((sum, result) => sum + result.pointsEarned, 0);
  const maxScore = itemResults.reduce((sum, result) => sum + result.pointsPossible, 0);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const answeredCount = itemResults.filter((result) => result.answered).length;
  const answeredRatio = items.length > 0 ? answeredCount / items.length : 0;

  const insufficientReasons: string[] = [];
  if (items.length === 0 || maxScore === 0) {
    insufficientReasons.push('no_scored_items');
  }
  if (answeredRatio < rubric.minAnsweredRatio) {
    insufficientReasons.push('too_few_items_answered');
  }
  for (const criterion of criteria) {
    if (criterion.answered < Math.min(rubric.minItemsAnsweredPerCriterion, criterion.total) || criterion.total === 0) {
      insufficientReasons.push(`criterion_not_covered:${criterion.key}`);
    }
  }

  const outcome = insufficientReasons.length === 0 ? 'graded' : 'insufficient_evidence';
  const sortedBands = [...rubric.gradeBands].sort((a, b) => b.minPercent - a.minPercent);
  const indicativeGrade = outcome === 'graded'
    ? sortedBands.find((band) => percent >= band.minPercent)?.grade ?? null
    : null;

  const nextSteps = criteria
    .filter((criterion) => criterion.percent < 70)
    .sort((a, b) => a.percent - b.percent)
    .map((criterion) => `${criterion.label}: ${criterion.description}`);

  return {
    score,
    maxScore,
    percent,
    answeredRatio: Math.round(answeredRatio * 100) / 100,
    outcome,
    indicativeGrade,
    insufficientReasons,
    criteria,
    items: itemResults,
    nextSteps,
    limitations: rubric.limitations,
    disclaimer: rubric.disclaimer
  };
}
