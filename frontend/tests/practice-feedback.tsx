// Synthetic renderer contract test. Real API authorization is exercised by
// backend/src/test/pr13-authorization.test.ts; no application data/auth is used.
import { Component, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import MultipleChoice from '../src/components/activities/MultipleChoiceActivity';
import FillBlanks from '../src/components/activities/FillBlanksActivity';
import Matching from '../src/components/activities/MatchingActivity';
import Sorting from '../src/components/activities/SortingActivity';
import DragDrop from '../src/components/activities/DragDropActivity';
import Crossword from '../src/components/activities/CrosswordActivity';
import LessonPractice from '../src/components/learn/LessonPractice';
import { ProfileProvider, useProfile } from '../src/context/ProfileContext';
import type { LearningActivity, ActivitySubmissionResult } from '../src/types/activities';

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <p data-testid="error">{this.state.error}</p> : this.props.children; }
}
const examples = [
  { id: 'mcq', View: MultipleChoice, content: { question: 'One plus one?', options: [{ id: 'a', text: 'Two' }, { id: 'b', text: 'Three' }] }, response: { answer: 'a' }, key: { correctAnswer: 'a' } },
  { id: 'blanks', View: FillBlanks, content: { sentences: ['One plus one is ___ and two plus two is ___.'] }, response: { answers: ['two', 'four'] }, key: { blanks: [{ position: 0, answer: 'two' }, { position: 1, answer: 'four' }] } },
  { id: 'matching', View: Matching, content: { pairs: [{ left: 'One', right: '1' }] }, response: { matches: { 0: 0 } }, key: { correctPairs: { 0: 0 } } },
  { id: 'sorting', View: Sorting, content: { items: [{ id: 'first', text: 'First' }, { id: 'second', text: 'Second' }] }, response: { order: ['first', 'second'] }, key: { correctOrder: ['first', 'second'] } },
  { id: 'drag', View: DragDrop, content: { draggableItems: [{ id: 'one', text: 'One' }], dropZones: [{ id: 'zone', label: 'Numbers' }] }, response: { placements: { zone: ['one'] } }, key: { correctPlacements: { zone: ['one'] } } },
  { id: 'crossword', View: Crossword, content: { grid: [['']], clues: { across: [{ number: 1, clue: 'First letter', startRow: 0, startCol: 0 }], down: [] } }, response: { answers: { '0-0': 'A' } }, key: { solution: { '0-0': 'A' } } }
];
function Example({ example }: { example: typeof examples[number] }) {
  const [submitted, setSubmitted] = useState(false);
  const wrong = new URLSearchParams(window.location.search).has('wrong') && ['mcq', 'blanks'].includes(example.id);
  const View = example.View;
  const activity = {
    id: 1, session_id: 1, activity_type_id: 1, title: example.id,
    content_data: example.content, hints: [], points: 20, order_index: 0, difficulty: 'easy', created_at: ''
  } as LearningActivity;
  const feedback = submitted ? { score: wrong ? 0 : 20, maxScore: 20, isCorrect: !wrong, partialScore: wrong ? 0 : 1, feedback: wrong ? 'Try again' : 'Correct', correctData: example.key } as ActivitySubmissionResult : null;
  const response = wrong ? (example.id === 'mcq' ? { answer: 'b' } : { answers: ['wrong', 'wrong'] }) : example.response;
  return <section data-testid={example.id}>
    <button onClick={() => setSubmitted(true)}>Show submitted feedback</button>
    <Boundary><View activity={activity} onResponse={() => {}} currentResponse={response} disabled={submitted} showFeedback={submitted} feedbackResult={feedback} theme={{ colors: { primary: '#123456' } }} /></Boundary>
  </section>;
}
function ResumePractice() {
  const [generation, setGeneration] = useState(0);
  const { currentProfile } = useProfile();
  return <>
    <span data-testid="profile-ready">{currentProfile?.id}</span>
    <button onClick={() => setGeneration(value => value + 1)}>Remount practice</button>
    <LessonPractice key={generation} lessonId={1} locale="en" result={null} onCompleted={() => {}} />
  </>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('resume')
  ? <Boundary><ProfileProvider><ResumePractice /></ProfileProvider></Boundary>
  : <>{examples.map(example => <Example key={example.id} example={example} />)}</>);
