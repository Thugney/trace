import { describe, expect, it } from 'vitest';
import {
  QuizSpec,
  convertQuizSpecToH5P,
  extractQuizSpecFromAiPrompt,
  questionSetNeedsRepair
} from '../services/h5pService.js';

describe('H5P quiz conversion', () => {
  const quizSpec: QuizSpec = {
    title: 'Fun Alphabet Quiz',
    theme: 'Alphabet',
    age: 5,
    questions: [
      {
        type: 'fill_blank',
        prompt: 'The letter that comes before E is __.',
        correctAnswer: 'D',
        explanation: 'D comes right before E in the alphabet.'
      }
    ]
  };

  it('converts fill_blank questions to the H5P.Blanks questions list format', () => {
    const converted = convertQuizSpecToH5P(quizSpec);
    const blankQuestion = converted.params.questions[0];

    expect(blankQuestion.library).toBe('H5P.Blanks 1.14');
    expect(blankQuestion.params.text).toBe('Fill in the missing answer.');
    expect(blankQuestion.params.questions).toEqual([
      {
        question: '<p>The letter that comes before E is *D*.</p>'
      }
    ]);
  });

  it('extracts quiz specs from wrapped ai_prompt payloads', () => {
    const aiPrompt = JSON.stringify({
      theme: 'Alphabet',
      age: 5,
      provider: 'grok',
      quizSpec
    });

    expect(extractQuizSpecFromAiPrompt(aiPrompt)).toEqual(quizSpec);
  });

  it('marks legacy blank-question payloads for repair', () => {
    const legacyQuestionSetParams = {
      introPage: {
        title: 'Fun Alphabet Quiz'
      },
      questions: [
        {
          library: 'H5P.Blanks 1.14',
          params: {
            text: '<p>The letter that comes before E is __.</p>'
          }
        }
      ]
    };

    const converted = convertQuizSpecToH5P(quizSpec);

    expect(questionSetNeedsRepair(legacyQuestionSetParams, quizSpec)).toBe(true);
    expect(questionSetNeedsRepair(converted.params, quizSpec)).toBe(false);
  });

  it('does not rewrite already-structured blank questions just because prompt text differs', () => {
    const structuredQuestionSetParams = {
      introPage: {
        title: 'Fun Alphabet Quiz'
      },
      questions: [
        {
          library: 'H5P.Blanks 1.14',
          params: {
            text: 'Type the answer in the box.',
            questions: [
              {
                question: '<p>The letter that comes before E is *D*.</p>'
              }
            ]
          }
        }
      ]
    };

    expect(questionSetNeedsRepair(structuredQuestionSetParams, quizSpec)).toBe(false);
  });
});
