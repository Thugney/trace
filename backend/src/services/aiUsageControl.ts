/**
 * AI Usage Control Service
 * Tracks AI generation usage and enforces limits per family
 */

import { db } from '../database/init';

// Cost estimates per provider (approximate)
export const AI_COSTS = {
  ollama: { text: 0, image: 0 }, // Local/free
  gemini: { text: 0.01, image: 0.02 },
  grok: { text: 0.015, image: 0.02 },
  openai: { text: 0.02, image: 0.04 }
};

export interface AiUsageLog {
  id: number;
  profile_id: number;
  parent_id: number | null;
  feature_type: 'book' | 'quiz' | 'task' | 'chat' | 'activity';
  provider: string;
  estimated_cost: number;
  tokens_used: number;
  images_generated: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface AiGenerationLimits {
  id: number;
  parent_id: number;
  daily_book_limit: number;
  daily_quiz_limit: number;
  daily_task_limit: number;
  daily_activity_limit: number;
  monthly_cost_limit: number;
  require_approval: boolean;
  enabled: boolean;
}

/**
 * Get the parent ID for a given profile
 */
export function getParentIdForProfile(profileId: number): number | null {
  const profile: any = db.prepare(`
    SELECT parent_id, type FROM profiles WHERE id = ?
  `).get(profileId);

  if (!profile) return null;

  // If they are a parent/admin, they are their own parent for quota purposes
  if (profile.type === 'parent' || profile.type === 'admin') {
    return profileId;
  }

  return profile.parent_id;
}

/**
 * Get AI generation limits for a family (by parent ID)
 * Returns default limits if none set
 */
export function getAiLimits(parentId: number): AiGenerationLimits {
  const limits: any = db.prepare(`
    SELECT * FROM ai_generation_limits WHERE parent_id = ?
  `).get(parentId);

  if (limits) {
    return {
      ...limits,
      require_approval: !!limits.require_approval,
      enabled: limits.enabled !== 0
    };
  }

  // Return defaults
  return {
    id: 0,
    parent_id: parentId,
    daily_book_limit: 5,
    daily_quiz_limit: 10,
    daily_task_limit: 20,
    daily_activity_limit: 10,
    monthly_cost_limit: 10.00,
    require_approval: false,
    enabled: true
  };
}

/**
 * Get today's usage count for a specific feature type
 */
export function getTodayUsageCount(parentId: number, featureType: 'book' | 'quiz' | 'task' | 'chat' | 'activity'): number {
  const today = new Date().toISOString().split('T')[0];

  const result: any = db.prepare(`
    SELECT COUNT(*) as count FROM ai_usage_logs
    WHERE parent_id = ?
      AND feature_type = ?
      AND date(created_at) = ?
      AND success = 1
  `).get(parentId, featureType, today);

  return result?.count || 0;
}

/**
 * Get this month's total estimated cost
 */
export function getMonthlyUsageCost(parentId: number): number {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const result: any = db.prepare(`
    SELECT COALESCE(SUM(estimated_cost), 0) as total_cost FROM ai_usage_logs
    WHERE parent_id = ?
      AND created_at >= ?
      AND success = 1
  `).get(parentId, monthStart.toISOString());

  return result?.total_cost || 0;
}

/**
 * Check if AI generation is allowed for a profile
 * Returns { allowed: boolean, reason?: string, remaining?: number }
 */
export function canGenerateAi(
  profileId: number,
  featureType: 'book' | 'quiz' | 'task' | 'chat' | 'activity',
  estimatedCost: number = 0
): { allowed: boolean; reason?: string; remaining?: number; dailyLimit?: number } {
  const parentId = getParentIdForProfile(profileId);

  if (!parentId) {
    return { allowed: false, reason: 'Profile not found or has no parent' };
  }

  const limits = getAiLimits(parentId);

  // Check if AI is enabled for this family
  if (!limits.enabled) {
    return { allowed: false, reason: 'AI generation is disabled for your family' };
  }

  // Get the appropriate daily limit
  let dailyLimit = 0;
  switch (featureType) {
    case 'book':
      dailyLimit = limits.daily_book_limit;
      break;
    case 'quiz':
      dailyLimit = limits.daily_quiz_limit;
      break;
    case 'task':
      dailyLimit = limits.daily_task_limit;
      break;
    case 'chat':
      dailyLimit = 100; // High limit for chat
      break;
    case 'activity':
      dailyLimit = limits.daily_activity_limit;
      break;
  }

  // Check daily usage
  const todayCount = getTodayUsageCount(parentId, featureType);
  const remaining = dailyLimit - todayCount;

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Daily ${featureType} generation limit reached (${dailyLimit}/day). Try again tomorrow!`,
      remaining: 0,
      dailyLimit
    };
  }

  // Check monthly cost limit
  const monthlyUsed = getMonthlyUsageCost(parentId);
  if (monthlyUsed + estimatedCost > limits.monthly_cost_limit) {
    return {
      allowed: false,
      reason: `Monthly AI cost limit reached ($${limits.monthly_cost_limit.toFixed(2)}). Ask your parent to increase the limit.`,
      remaining
    };
  }

  return { allowed: true, remaining, dailyLimit };
}

/**
 * Log an AI usage event
 */
export function logAiUsage(
  profileId: number,
  featureType: 'book' | 'quiz' | 'task' | 'chat' | 'activity',
  provider: string,
  options: {
    estimatedCost?: number;
    tokensUsed?: number;
    imagesGenerated?: number;
    success?: boolean;
    errorMessage?: string;
  } = {}
): void {
  const parentId = getParentIdForProfile(profileId);

  db.prepare(`
    INSERT INTO ai_usage_logs (
      profile_id, parent_id, feature_type, provider,
      estimated_cost, tokens_used, images_generated, success, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    profileId,
    parentId,
    featureType,
    provider,
    options.estimatedCost || 0,
    options.tokensUsed || 0,
    options.imagesGenerated || 0,
    options.success !== false ? 1 : 0,
    options.errorMessage || null
  );
}

/**
 * Calculate estimated cost for a generation request
 */
export function estimateCost(
  textProvider: string,
  imageProvider: string | null,
  imageCount: number
): number {
  const textCost = AI_COSTS[textProvider as keyof typeof AI_COSTS]?.text || 0.02;
  const imageCost = imageProvider
    ? (AI_COSTS[imageProvider as keyof typeof AI_COSTS]?.image || 0.03) * imageCount
    : 0;

  return textCost + imageCost;
}

/**
 * Get usage statistics for a family
 */
export function getUsageStats(parentId: number): {
  today: { books: number; quizzes: number; tasks: number; activities: number };
  month: { totalCost: number; totalGenerations: number };
  limits: AiGenerationLimits;
} {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Today's usage
  const todayStats: any = db.prepare(`
    SELECT
      feature_type,
      COUNT(*) as count
    FROM ai_usage_logs
    WHERE parent_id = ? AND date(created_at) = ? AND success = 1
    GROUP BY feature_type
  `).all(parentId, today);

  const todayByType: any = { books: 0, quizzes: 0, tasks: 0, activities: 0 };
  for (const stat of todayStats) {
    if (stat.feature_type === 'book') todayByType.books = stat.count;
    if (stat.feature_type === 'quiz') todayByType.quizzes = stat.count;
    if (stat.feature_type === 'task') todayByType.tasks = stat.count;
    if (stat.feature_type === 'activity') todayByType.activities = stat.count;
  }

  // Month's usage
  const monthStats: any = db.prepare(`
    SELECT
      COALESCE(SUM(estimated_cost), 0) as total_cost,
      COUNT(*) as total_generations
    FROM ai_usage_logs
    WHERE parent_id = ? AND created_at >= ? AND success = 1
  `).get(parentId, monthStart.toISOString());

  return {
    today: todayByType,
    month: {
      totalCost: monthStats?.total_cost || 0,
      totalGenerations: monthStats?.total_generations || 0
    },
    limits: getAiLimits(parentId)
  };
}

/**
 * Update AI generation limits for a family
 */
export function updateAiLimits(
  parentId: number,
  updates: Partial<Omit<AiGenerationLimits, 'id' | 'parent_id'>>
): AiGenerationLimits {
  // Check if limits exist
  const existing = db.prepare('SELECT id FROM ai_generation_limits WHERE parent_id = ?').get(parentId);

  if (existing) {
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.daily_book_limit !== undefined) {
      updateFields.push('daily_book_limit = ?');
      values.push(updates.daily_book_limit);
    }
    if (updates.daily_quiz_limit !== undefined) {
      updateFields.push('daily_quiz_limit = ?');
      values.push(updates.daily_quiz_limit);
    }
    if (updates.daily_task_limit !== undefined) {
      updateFields.push('daily_task_limit = ?');
      values.push(updates.daily_task_limit);
    }
    if (updates.daily_activity_limit !== undefined) {
      updateFields.push('daily_activity_limit = ?');
      values.push(updates.daily_activity_limit);
    }
    if (updates.monthly_cost_limit !== undefined) {
      updateFields.push('monthly_cost_limit = ?');
      values.push(updates.monthly_cost_limit);
    }
    if (updates.require_approval !== undefined) {
      updateFields.push('require_approval = ?');
      values.push(updates.require_approval ? 1 : 0);
    }
    if (updates.enabled !== undefined) {
      updateFields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(parentId);

    if (updateFields.length > 1) {
      db.prepare(`UPDATE ai_generation_limits SET ${updateFields.join(', ')} WHERE parent_id = ?`).run(...values);
    }
  } else {
    // Create new limits
    db.prepare(`
      INSERT INTO ai_generation_limits (
        parent_id, daily_book_limit, daily_quiz_limit, daily_task_limit, daily_activity_limit,
        monthly_cost_limit, require_approval, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      parentId,
      updates.daily_book_limit ?? 5,
      updates.daily_quiz_limit ?? 10,
      updates.daily_task_limit ?? 20,
      updates.daily_activity_limit ?? 10,
      updates.monthly_cost_limit ?? 10.00,
      updates.require_approval ? 1 : 0,
      updates.enabled !== false ? 1 : 0
    );
  }

  return getAiLimits(parentId);
}
