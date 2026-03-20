import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TASK_TIMER_DURATIONS,
  formatTaskTimerDuration,
  getRequiredTaskTimerSeconds
} from '../services/taskTimer.js';

describe('task timer helpers', () => {
  it('uses the configured task duration when one is set', () => {
    expect(getRequiredTaskTimerSeconds({
      requires_timer: 1,
      timer_duration_minutes: 15,
      category: 'read-book'
    })).toBe(900);
  });

  it('falls back to the category default for older timed tasks without a saved duration', () => {
    expect(getRequiredTaskTimerSeconds({
      requires_timer: 1,
      timer_duration_minutes: null,
      category: 'clean-room'
    })).toBe(DEFAULT_TASK_TIMER_DURATIONS['clean-room'] * 60);
  });

  it('returns zero when a timer is not required', () => {
    expect(getRequiredTaskTimerSeconds({
      requires_timer: 0,
      timer_duration_minutes: 30,
      category: 'school'
    })).toBe(0);
  });

  it('formats whole minutes cleanly for timer messages', () => {
    expect(formatTaskTimerDuration(900)).toBe('15 minutes');
    expect(formatTaskTimerDuration(60)).toBe('1 minute');
  });
});
