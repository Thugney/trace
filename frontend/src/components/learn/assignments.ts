import type { LearnAssignment } from '../../types/learn';

// Where a learner opens an assignment, by what was assigned
export const assignmentLink = (assignment: LearnAssignment) => {
  if (assignment.target_kind === 'review_paper' && assignment.review_paper_id) return `/learn/papers/${assignment.review_paper_id}`;
  if (assignment.mock_exam_id) return `/learn/exams/${assignment.mock_exam_id}`;
  return `/learn/lessons/${assignment.lesson_id}`;
};

export const assignmentTitle = (assignment: LearnAssignment) =>
  assignment.title || assignment.lesson_title || assignment.mock_exam_title || assignment.review_paper_title || '';
