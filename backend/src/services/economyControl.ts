/**
 * Economy Control Service
 *
 * Prevents abuse and manages the game economy:
 * - Daily/weekly earning caps
 * - Rate limiting (cooldowns between actions)
 * - Time-based task verification
 * - Parent-configurable settings
 */

import db from '../database/init';

// Default economy settings
const DEFAULT_SETTINGS = {
  daily_points_cap: 200,
  weekly_points_cap: 1000,
  points_multiplier: 1.0,
  require_time_elapsed: true,
  min_task_duration_minutes: 5,
  cooldown_seconds: 10,
  bonuses_enabled: true,
  spin_wheel_enabled: true,
  countdown_challenges_enabled: true
};

interface EconomySettings {
  daily_points_cap: number;
  weekly_points_cap: number;
  points_multiplier: number;
  require_time_elapsed: boolean;
  min_task_duration_minutes: number;
  cooldown_seconds: number;
  bonuses_enabled: boolean;
  spin_wheel_enabled: boolean;
  countdown_challenges_enabled: boolean;
}

interface EarningTracker {
  points_earned: number;
  stars_earned: number;
  tasks_completed: number;
  bonuses_claimed: number;
  last_action_at: string;
}

/**
 * Get economy settings for a profile (creates defaults if not exists)
 */
export function getEconomySettings(profileId: number): EconomySettings {
  let settings: any = db.prepare(`
    SELECT * FROM economy_settings WHERE profile_id = ?
  `).get(profileId);

  if (!settings) {
    // Create default settings for this profile
    db.prepare(`
      INSERT INTO economy_settings (profile_id, daily_points_cap, weekly_points_cap, points_multiplier,
        require_time_elapsed, min_task_duration_minutes, cooldown_seconds, bonuses_enabled,
        spin_wheel_enabled, countdown_challenges_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileId,
      DEFAULT_SETTINGS.daily_points_cap,
      DEFAULT_SETTINGS.weekly_points_cap,
      DEFAULT_SETTINGS.points_multiplier,
      DEFAULT_SETTINGS.require_time_elapsed ? 1 : 0,
      DEFAULT_SETTINGS.min_task_duration_minutes,
      DEFAULT_SETTINGS.cooldown_seconds,
      DEFAULT_SETTINGS.bonuses_enabled ? 1 : 0,
      DEFAULT_SETTINGS.spin_wheel_enabled ? 1 : 0,
      DEFAULT_SETTINGS.countdown_challenges_enabled ? 1 : 0
    );
    settings = db.prepare(`SELECT * FROM economy_settings WHERE profile_id = ?`).get(profileId);
  }

  return {
    daily_points_cap: settings.daily_points_cap,
    weekly_points_cap: settings.weekly_points_cap,
    points_multiplier: settings.points_multiplier,
    require_time_elapsed: !!settings.require_time_elapsed,
    min_task_duration_minutes: settings.min_task_duration_minutes,
    cooldown_seconds: settings.cooldown_seconds,
    bonuses_enabled: !!settings.bonuses_enabled,
    spin_wheel_enabled: !!settings.spin_wheel_enabled,
    countdown_challenges_enabled: !!settings.countdown_challenges_enabled
  };
}

/**
 * Update economy settings for a profile (parent action)
 */
export function updateEconomySettings(profileId: number, updates: Partial<EconomySettings>): EconomySettings {
  // Ensure settings exist
  getEconomySettings(profileId);

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.daily_points_cap !== undefined) {
    fields.push('daily_points_cap = ?');
    values.push(Math.max(10, updates.daily_points_cap)); // Minimum 10
  }
  if (updates.weekly_points_cap !== undefined) {
    fields.push('weekly_points_cap = ?');
    values.push(Math.max(50, updates.weekly_points_cap)); // Minimum 50
  }
  if (updates.points_multiplier !== undefined) {
    fields.push('points_multiplier = ?');
    values.push(Math.max(0.1, Math.min(2.0, updates.points_multiplier))); // 0.1 to 2.0
  }
  if (updates.require_time_elapsed !== undefined) {
    fields.push('require_time_elapsed = ?');
    values.push(updates.require_time_elapsed ? 1 : 0);
  }
  if (updates.min_task_duration_minutes !== undefined) {
    fields.push('min_task_duration_minutes = ?');
    values.push(Math.max(1, updates.min_task_duration_minutes));
  }
  if (updates.cooldown_seconds !== undefined) {
    fields.push('cooldown_seconds = ?');
    values.push(Math.max(5, updates.cooldown_seconds)); // Minimum 5 seconds
  }
  if (updates.bonuses_enabled !== undefined) {
    fields.push('bonuses_enabled = ?');
    values.push(updates.bonuses_enabled ? 1 : 0);
  }
  if (updates.spin_wheel_enabled !== undefined) {
    fields.push('spin_wheel_enabled = ?');
    values.push(updates.spin_wheel_enabled ? 1 : 0);
  }
  if (updates.countdown_challenges_enabled !== undefined) {
    fields.push('countdown_challenges_enabled = ?');
    values.push(updates.countdown_challenges_enabled ? 1 : 0);
  }

  if (fields.length > 0) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(profileId);
    db.prepare(`UPDATE economy_settings SET ${fields.join(', ')} WHERE profile_id = ?`).run(...values);
  }

  return getEconomySettings(profileId);
}

/**
 * Get today's earning tracker for a profile
 */
export function getTodayEarnings(profileId: number): EarningTracker {
  const today = new Date().toISOString().split('T')[0];

  let tracker: any = db.prepare(`
    SELECT * FROM earning_tracker WHERE profile_id = ? AND date = ?
  `).get(profileId, today);

  if (!tracker) {
    db.prepare(`
      INSERT INTO earning_tracker (profile_id, date, points_earned, stars_earned, tasks_completed, bonuses_claimed)
      VALUES (?, ?, 0, 0, 0, 0)
    `).run(profileId, today);
    tracker = db.prepare(`SELECT * FROM earning_tracker WHERE profile_id = ? AND date = ?`).get(profileId, today);
  }

  return {
    points_earned: tracker.points_earned,
    stars_earned: tracker.stars_earned,
    tasks_completed: tracker.tasks_completed,
    bonuses_claimed: tracker.bonuses_claimed,
    last_action_at: tracker.last_action_at
  };
}

/**
 * Get this week's total earnings
 */
export function getWeekEarnings(profileId: number): number {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const result: any = db.prepare(`
    SELECT COALESCE(SUM(points_earned), 0) as total
    FROM earning_tracker
    WHERE profile_id = ? AND date >= ?
  `).get(profileId, weekStartStr);

  return result?.total || 0;
}

/**
 * Check if profile can earn more points today
 */
export function canEarnPoints(profileId: number, pointsToEarn: number): { allowed: boolean; reason?: string; cappedAmount?: number } {
  const settings = getEconomySettings(profileId);
  const todayEarnings = getTodayEarnings(profileId);
  const weekEarnings = getWeekEarnings(profileId);

  // Check daily cap
  if (todayEarnings.points_earned >= settings.daily_points_cap) {
    return {
      allowed: false,
      reason: `Daily limit reached (${settings.daily_points_cap} points). Try again tomorrow!`
    };
  }

  // Check weekly cap
  if (weekEarnings >= settings.weekly_points_cap) {
    return {
      allowed: false,
      reason: `Weekly limit reached (${settings.weekly_points_cap} points). Resets on Sunday!`
    };
  }

  // Calculate how much can still be earned
  const dailyRemaining = settings.daily_points_cap - todayEarnings.points_earned;
  const weeklyRemaining = settings.weekly_points_cap - weekEarnings;
  const maxAllowed = Math.min(dailyRemaining, weeklyRemaining);

  if (pointsToEarn > maxAllowed) {
    return {
      allowed: true,
      cappedAmount: maxAllowed,
      reason: `Points capped to ${maxAllowed} (approaching limit)`
    };
  }

  return { allowed: true };
}

/**
 * Check rate limit (cooldown between actions)
 */
export function checkRateLimit(profileId: number, actionType: 'task' | 'bonus' | 'spin'): { allowed: boolean; waitSeconds?: number } {
  const settings = getEconomySettings(profileId);
  const cooldownMs = settings.cooldown_seconds * 1000;

  let tracker: any = db.prepare(`SELECT * FROM rate_limit_tracker WHERE profile_id = ?`).get(profileId);

  if (!tracker) {
    db.prepare(`INSERT INTO rate_limit_tracker (profile_id) VALUES (?)`).run(profileId);
    return { allowed: true };
  }

  const now = Date.now();
  let lastActionTime: number | null = null;

  switch (actionType) {
    case 'task':
      lastActionTime = tracker.last_task_complete_at ? new Date(tracker.last_task_complete_at).getTime() : null;
      break;
    case 'bonus':
      lastActionTime = tracker.last_bonus_claim_at ? new Date(tracker.last_bonus_claim_at).getTime() : null;
      break;
    case 'spin':
      lastActionTime = tracker.last_spin_at ? new Date(tracker.last_spin_at).getTime() : null;
      break;
  }

  if (lastActionTime && (now - lastActionTime) < cooldownMs) {
    const waitSeconds = Math.ceil((cooldownMs - (now - lastActionTime)) / 1000);
    return { allowed: false, waitSeconds };
  }

  return { allowed: true };
}

/**
 * Update rate limit tracker after an action
 */
export function updateRateLimit(profileId: number, actionType: 'task' | 'bonus' | 'spin'): void {
  const now = new Date().toISOString();

  // Ensure tracker exists
  db.prepare(`INSERT OR IGNORE INTO rate_limit_tracker (profile_id) VALUES (?)`).run(profileId);

  switch (actionType) {
    case 'task':
      db.prepare(`UPDATE rate_limit_tracker SET last_task_complete_at = ? WHERE profile_id = ?`).run(now, profileId);
      break;
    case 'bonus':
      db.prepare(`UPDATE rate_limit_tracker SET last_bonus_claim_at = ? WHERE profile_id = ?`).run(now, profileId);
      break;
    case 'spin':
      db.prepare(`UPDATE rate_limit_tracker SET last_spin_at = ? WHERE profile_id = ?`).run(now, profileId);
      break;
  }
}

/**
 * Record earnings (updates daily tracker)
 */
export function recordEarnings(profileId: number, points: number, stars: number, isTask: boolean, isBonus: boolean): void {
  const today = new Date().toISOString().split('T')[0];

  // Ensure tracker exists
  getTodayEarnings(profileId);

  const updates: string[] = ['last_action_at = CURRENT_TIMESTAMP'];

  if (points > 0) updates.push(`points_earned = points_earned + ${points}`);
  if (stars > 0) updates.push(`stars_earned = stars_earned + ${stars}`);
  if (isTask) updates.push('tasks_completed = tasks_completed + 1');
  if (isBonus) updates.push('bonuses_claimed = bonuses_claimed + 1');

  db.prepare(`
    UPDATE earning_tracker SET ${updates.join(', ')} WHERE profile_id = ? AND date = ?
  `).run(profileId, today);
}

/**
 * Check if enough time has elapsed for a timed task
 */
export function checkTaskTimeElapsed(task: any): { allowed: boolean; reason?: string; minutesRemaining?: number } {
  // If task doesn't have estimated time, allow completion
  if (!task.estimated_minutes || task.estimated_minutes <= 0) {
    return { allowed: true };
  }

  const settings = getEconomySettings(task.profile_id);

  // If time verification is disabled, allow
  if (!settings.require_time_elapsed) {
    return { allowed: true };
  }

  const createdAt = new Date(task.created_at).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - createdAt) / (1000 * 60);

  // Use the larger of task's estimated time or minimum duration
  const requiredMinutes = Math.max(task.estimated_minutes, settings.min_task_duration_minutes);

  if (elapsedMinutes < requiredMinutes) {
    const remaining = Math.ceil(requiredMinutes - elapsedMinutes);
    return {
      allowed: false,
      reason: `This task requires ${requiredMinutes} minutes. Please wait ${remaining} more minute(s).`,
      minutesRemaining: remaining
    };
  }

  return { allowed: true };
}

/**
 * Get active power-up multiplier for a profile (e.g., from spin wheel)
 * Returns the multiplier value if an active, non-expired power-up exists
 */
export function getActivePowerUpMultiplier(profileId: number): number {
  const now = new Date().toISOString();

  const powerUp: any = db.prepare(`
    SELECT * FROM power_ups
    WHERE profile_id = ? AND power_up_type = 'spin_multiplier' AND expires_at > ?
    ORDER BY expires_at DESC LIMIT 1
  `).get(profileId, now);

  if (powerUp && powerUp.quantity > 1) {
    return powerUp.quantity; // quantity stores the multiplier value (e.g., 2 for 2x)
  }

  return 1; // No active power-up
}

/**
 * Apply points multiplier from economy settings AND active power-ups
 * Power-ups stack multiplicatively with economy settings
 */
export function applyPointsMultiplier(profileId: number, basePoints: number): number {
  const settings = getEconomySettings(profileId);
  const powerUpMultiplier = getActivePowerUpMultiplier(profileId);

  // Apply both multipliers: economy setting * power-up
  const totalMultiplier = settings.points_multiplier * powerUpMultiplier;
  return Math.round(basePoints * totalMultiplier);
}

/**
 * Get earning summary for display
 */
export function getEarningSummary(profileId: number): {
  today: EarningTracker;
  weekTotal: number;
  settings: EconomySettings;
  dailyRemaining: number;
  weeklyRemaining: number;
} {
  const settings = getEconomySettings(profileId);
  const today = getTodayEarnings(profileId);
  const weekTotal = getWeekEarnings(profileId);

  return {
    today,
    weekTotal,
    settings,
    dailyRemaining: Math.max(0, settings.daily_points_cap - today.points_earned),
    weeklyRemaining: Math.max(0, settings.weekly_points_cap - weekTotal)
  };
}

/**
 * Check if bonuses are enabled for a profile
 */
export function areBonusesEnabled(profileId: number): boolean {
  const settings = getEconomySettings(profileId);
  return settings.bonuses_enabled;
}

/**
 * Check if spin wheel is enabled for a profile
 */
export function isSpinWheelEnabled(profileId: number): boolean {
  const settings = getEconomySettings(profileId);
  return settings.spin_wheel_enabled;
}

/**
 * Check if countdown challenges are enabled for a profile
 */
export function areCountdownChallengesEnabled(profileId: number): boolean {
  const settings = getEconomySettings(profileId);
  return settings.countdown_challenges_enabled;
}

export default {
  getEconomySettings,
  updateEconomySettings,
  getTodayEarnings,
  getWeekEarnings,
  canEarnPoints,
  checkRateLimit,
  updateRateLimit,
  recordEarnings,
  checkTaskTimeElapsed,
  applyPointsMultiplier,
  getActivePowerUpMultiplier,
  getEarningSummary,
  areBonusesEnabled,
  isSpinWheelEnabled,
  areCountdownChallengesEnabled
};
