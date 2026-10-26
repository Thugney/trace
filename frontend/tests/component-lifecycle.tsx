// Browser-test entry only; excluded from the production index and bundle.
// Mounts the real components inside small parents that rerender, swap
// activities and switch ids the way the app pages do. Driven by
// component-lifecycle.test.mjs; all API responses are synthetic.
import { Component, useCallback, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import SimpleTaskCard from '../src/components/SimpleTaskCard';
import HiddenAchievements from '../src/components/HiddenAchievements';
import MemoryGameActivity from '../src/components/activities/MemoryGameActivity';
import SortingActivity from '../src/components/activities/SortingActivity';
import DragDropActivity from '../src/components/activities/DragDropActivity';
import MatchingActivity from '../src/components/activities/MatchingActivity';
import H5PPlayer from '../src/components/H5PPlayer';
import CountdownChallengeCard from '../src/components/CountdownChallengeCard';
import LessonFlashcards from '../src/components/learn/LessonFlashcards';
import { ProfileProvider, useProfile } from '../src/context/ProfileContext';
import type { LearningActivity } from '../src/types/activities';

// Every response object reported to the parent, unserialized, so a test can
// see whether a component later mutated one it already handed over.
const reportedResponses: unknown[] = [];
// Every call of a parent callback prop, with the parent render that created
// the callback, so a test can tell a current callback from a stale one.
const callbackCalls: { callback: string; generation: number; detail?: unknown }[] = [];
Object.assign(window, { __harnessResponses: reportedResponses, __harnessCallbacks: callbackCalls });

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    return this.state.error
      ? <p data-testid="harness-error">{this.state.error}</p>
      : this.props.children;
  }
}

function makeActivity(
  id: number,
  type: string,
  content: unknown,
  correct: unknown
): LearningActivity {
  return {
    id,
    session_id: 1,
    activity_type_id: 1,
    activity_type_name: type,
    title: `Activity ${id}`,
    content_data: content as LearningActivity['content_data'],
    correct_data: correct as LearningActivity['correct_data'],
    hints: [],
    points: 10,
    order_index: id,
    difficulty: 'easy',
    created_at: '2026-01-01T00:00:00Z'
  };
}

// Consecutive activities of one type with the same item count, so only the
// data identifies the change.
const memoryActivities = [
  makeActivity(101, 'memory_game', { pairs: [{ front: 'Sun', back: 'Sol' }, { front: 'Moon', back: 'Maane' }] }, {}),
  makeActivity(102, 'memory_game', { pairs: [{ front: 'Cat', back: 'Katt' }, { front: 'Dog', back: 'Hund' }] }, {})
];

const sortingActivities = [
  makeActivity(201, 'sorting', { items: [{ id: 'a1', text: 'Alpha' }, { id: 'a2', text: 'Bravo' }, { id: 'a3', text: 'Charlie' }] }, { correctOrder: ['a1', 'a2', 'a3'] }),
  makeActivity(202, 'sorting', { items: [{ id: 'b1', text: 'Delta' }, { id: 'b2', text: 'Echo' }, { id: 'b3', text: 'Foxtrot' }] }, { correctOrder: ['b1', 'b2', 'b3'] }),
  // Shorter, so a selection left at the last index of 202 would be out of range.
  makeActivity(203, 'sorting', { items: [{ id: 'c1', text: 'Golf' }, { id: 'c2', text: 'Hotel' }] }, { correctOrder: ['c1', 'c2'] })
];

const dragDropActivities = [
  makeActivity(301, 'drag_drop', {
    draggableItems: [{ id: 'apple', text: 'Apple' }, { id: 'carrot', text: 'Carrot' }, { id: 'pebble', text: 'Pebble' }],
    dropZones: [{ id: 'fruit', label: 'Fruit' }, { id: 'vegetable', label: 'Vegetable' }]
  }, { correctPlacements: { fruit: ['apple'], vegetable: ['carrot'] } }),
  makeActivity(302, 'drag_drop', {
    draggableItems: [{ id: 'salmon', text: 'Salmon' }, { id: 'oak', text: 'Oak' }, { id: 'moss', text: 'Moss' }],
    dropZones: [{ id: 'fish', label: 'Fish' }, { id: 'tree', label: 'Tree' }]
  }, { correctPlacements: { fish: ['salmon'], tree: ['oak'] } })
];

const matchingActivities = [
  makeActivity(401, 'matching', { pairs: [{ left: 'Red', right: 'Rot' }, { left: 'Blue', right: 'Blau' }, { left: 'Green', right: 'Gruen' }] }, { correctPairs: { 0: 0, 1: 1, 2: 2 } }),
  makeActivity(402, 'matching', { pairs: [{ left: 'One', right: 'Eins' }, { left: 'Two', right: 'Zwei' }, { left: 'Three', right: 'Drei' }] }, { correctPairs: { 0: 0, 1: 1, 2: 2 } }),
  makeActivity(403, 'matching', { pairs: [{ left: 'Up', right: 'Opp' }, { left: 'Down', right: 'Ned' }] }, { correctPairs: { 0: 0, 1: 1 } })
];

// Mirrors the LessonPractice/ActivityPlayer parents: one activity element
// reused across activities, a stable onResponse, and the response cleared on
// "next". savedResponse stands in for a parent restoring a stored answer.
function ActivityHost({ Activity, activities, savedResponse }: {
  Activity: typeof MemoryGameActivity;
  activities: LearningActivity[];
  savedResponse?: unknown;
}) {
  const [list, setList] = useState(activities);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<unknown>(null);
  const [renders, setRenders] = useState(0);

  const onResponse = useCallback((next: unknown) => {
    reportedResponses.push(next);
    setResponse(next);
  }, []);

  return (
    <>
      <button data-testid="harness-rerender" onClick={() => setRenders(count => count + 1)}>Rerender parent</button>
      <button data-testid="harness-clone" onClick={() => setList(prev => prev.map((item, i) => (i === index ? structuredClone(item) : item)))}>
        Clone activity
      </button>
      <button data-testid="harness-next" onClick={() => { setIndex(i => i + 1); setResponse(null); }}>Next activity</button>
      <button data-testid="harness-restore" onClick={() => setResponse(structuredClone(savedResponse))}>Restore saved response</button>
      <span data-testid="harness-renders">{renders}</span>
      <pre data-testid="harness-response">{JSON.stringify(response)}</pre>
      <div data-testid="activity">
        <Activity
          activity={list[index]}
          onResponse={onResponse}
          currentResponse={response}
          disabled={false}
          showFeedback={false}
          feedbackResult={null}
          theme={{}}
        />
      </div>
    </>
  );
}

// Passes a new inline callback on every render, as the app pages do.
function H5PHost() {
  const [renders, setRenders] = useState(0);

  return (
    <>
      <button data-testid="harness-rerender" onClick={() => setRenders(count => count + 1)}>Rerender parent</button>
      <span data-testid="harness-renders">{renders}</span>
      <H5PPlayer
        contentId={5}
        onError={message => callbackCalls.push({ callback: 'onError', generation: renders, detail: message })}
      />
    </>
  );
}

function CountdownHost() {
  const [renders, setRenders] = useState(0);

  return (
    <>
      <button data-testid="harness-rerender" onClick={() => setRenders(count => count + 1)}>Rerender parent</button>
      <span data-testid="harness-renders">{renders}</span>
      <CountdownChallengeCard
        profileId={3}
        onChallengeComplete={() => callbackCalls.push({ callback: 'onChallengeComplete', generation: renders })}
      />
    </>
  );
}

function TaskHost() {
  const [task, setTask] = useState({
    id: 41,
    title: 'Read for a while',
    category: 'read-book',
    points: 10,
    completed: false,
    requires_timer: 1,
    timer_duration_minutes: 1
  });
  const [completions, setCompletions] = useState(0);

  return (
    <>
      <span data-testid="harness-completions">{completions}</span>
      <SimpleTaskCard
        task={task}
        onComplete={() => {
          setCompletions(count => count + 1);
          setTask(previous => ({ ...previous, completed: true }));
        }}
      />
    </>
  );
}

function FlashcardsHost() {
  const [lessonId, setLessonId] = useState(7);
  const [renders, setRenders] = useState(0);

  return (
    <>
      <button data-testid="harness-rerender" onClick={() => setRenders(count => count + 1)}>Rerender parent</button>
      <button data-testid="harness-switch" onClick={() => setLessonId(8)}>Switch lesson</button>
      <span data-testid="harness-renders">{renders}</span>
      <LessonFlashcards lessonId={lessonId} locale="en" />
    </>
  );
}

function AchievementsHost() {
  const [profileId, setProfileId] = useState(1);
  const [renders, setRenders] = useState(0);

  return (
    <>
      <button data-testid="harness-rerender" onClick={() => setRenders(count => count + 1)}>Rerender parent</button>
      <button data-testid="harness-switch" onClick={() => setProfileId(2)}>Switch profile</button>
      <span data-testid="harness-renders">{renders}</span>
      <HiddenAchievements profileId={profileId} />
    </>
  );
}

function ProfileProbe() {
  const { profiles, currentProfile, setCurrentProfile, isLoading } = useProfile();

  return (
    <>
      <span data-testid="profile-loading">{String(isLoading)}</span>
      <span data-testid="profile-current">{currentProfile ? `${currentProfile.id}:${currentProfile.name}` : 'none'}</span>
      {profiles.map(profile => (
        <button key={profile.id} data-testid={`select-${profile.id}`} onClick={() => setCurrentProfile(profile)}>
          {profile.name}
        </button>
      ))}
    </>
  );
}

const scenarios: Record<string, () => ReactNode> = {
  'timer-task': () => <TaskHost />,
  memory: () => <ActivityHost Activity={MemoryGameActivity} activities={memoryActivities} />,
  sorting: () => <ActivityHost Activity={SortingActivity} activities={sortingActivities} />,
  'drag-drop': () => <ActivityHost Activity={DragDropActivity} activities={dragDropActivities} />,
  matching: () => <ActivityHost Activity={MatchingActivity} activities={matchingActivities} savedResponse={{ matches: { 2: 2 } }} />,
  h5p: () => <H5PHost />,
  countdown: () => <CountdownHost />,
  flashcards: () => <FlashcardsHost />,
  achievements: () => <AchievementsHost />,
  profile: () => <ProfileProvider><ProfileProbe /></ProfileProvider>
};

const scenario = new URLSearchParams(location.search).get('scenario') ?? '';
const render = scenarios[scenario];
createRoot(document.getElementById('root')!).render(
  <Boundary>{render ? render() : <p data-testid="harness-error">Unknown scenario: {scenario}</p>}</Boundary>
);
