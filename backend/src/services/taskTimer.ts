export const TIMED_TASK_CATEGORIES = ['read-book', 'tigrinya', 'clean-room', 'clean-kitchen', 'school'];

export const DEFAULT_TASK_TIMER_DURATIONS: Record<string, number> = {
  'read-book': 15,
  'tigrinya': 20,
  'clean-room': 15,
  'clean-kitchen': 20,
  'school': 30,
  'other': 10
};

export function getRequiredTaskTimerSeconds(task: {
  requires_timer?: boolean | number;
  timer_duration_minutes?: number | null;
  category?: string | null;
}): number {
  if (!task?.requires_timer) {
    return 0;
  }

  if (typeof task.timer_duration_minutes === 'number' && Number.isFinite(task.timer_duration_minutes) && task.timer_duration_minutes > 0) {
    return Math.round(task.timer_duration_minutes * 60);
  }

  const category = task.category || 'other';
  const fallbackMinutes = DEFAULT_TASK_TIMER_DURATIONS[category] || DEFAULT_TASK_TIMER_DURATIONS.other || 1;
  return fallbackMinutes * 60;
}

export function formatTaskTimerDuration(seconds: number): string {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}
