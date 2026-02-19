import { testDb } from './setup.js';

// Create a test profile
export function createTestProfile(overrides: Partial<{
  name: string;
  type: 'admin' | 'parent' | 'child';
  age: number;
  avatar: string;
  pin: string;
  parent_id: number;
  ai_enabled: number;
  diet_enabled: number;
}> = {}) {
  const defaults = {
    name: 'Test User',
    type: 'child' as const,
    age: 10,
    avatar: null,
    pin: null,
    parent_id: null,
    ai_enabled: 0,
    diet_enabled: 0
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO profiles (name, type, age, avatar, pin, parent_id, ai_enabled, diet_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.name, data.type, data.age, data.avatar, data.pin, data.parent_id, data.ai_enabled, data.diet_enabled);

  return testDb.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create a test task
export function createTestTask(profileId: number, overrides: Partial<{
  title: string;
  description: string;
  category: string;
  points: number;
  difficulty: string;
  completed: number;
  needs_approval: number;
  created_by: number;
  proof_required: number;
  proof_photo_url: string;
}> = {}) {
  const defaults = {
    title: 'Test Task',
    description: 'Test description',
    category: 'other',
    points: 10,
    difficulty: 'easy',
    completed: 0,
    needs_approval: 0,
    created_by: null,
    proof_required: 0,
    proof_photo_url: null
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO tasks (profile_id, title, description, category, points, difficulty, completed, needs_approval, created_by, proof_required, proof_photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(profileId, data.title, data.description, data.category, data.points, data.difficulty, data.completed, data.needs_approval, data.created_by, data.proof_required, data.proof_photo_url);

  return testDb.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create a test note
export function createTestNote(profileId: number, overrides: Partial<{
  title: string;
  content: string;
  color: string;
  category: string;
  is_pinned: number;
}> = {}) {
  const defaults = {
    title: 'Test Note',
    content: 'Test content',
    color: '#ffffff',
    category: null,
    is_pinned: 0
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO notes (profile_id, title, content, color, category, is_pinned)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(profileId, data.title, data.content, data.color, data.category, data.is_pinned);

  return testDb.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create initial progress for a profile
export function createTestProgress(profileId: number, overrides: Partial<{
  points_earned: number;
  stars_earned: number;
  level: number;
  total_points: number;
  total_stars: number;
}> = {}) {
  const defaults = {
    points_earned: 0,
    stars_earned: 0,
    level: 1,
    total_points: 0,
    total_stars: 0
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO progress (profile_id, points_earned, stars_earned, level, total_points, total_stars)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(profileId, data.points_earned, data.stars_earned, data.level, data.total_points, data.total_stars);

  return testDb.prepare('SELECT * FROM progress WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create a test streak
export function createTestStreak(profileId: number, streakType: string = 'tasks', overrides: Partial<{
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
}> = {}) {
  const defaults = {
    current_streak: 0,
    longest_streak: 0,
    last_activity_date: null
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO streaks (profile_id, streak_type, current_streak, longest_streak, last_activity_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(profileId, streakType, data.current_streak, data.longest_streak, data.last_activity_date);

  return testDb.prepare('SELECT * FROM streaks WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create a test achievement
export function createTestAchievement(overrides: Partial<{
  name: string;
  description: string;
  icon: string;
  points_reward: number;
  requirement_type: string;
  requirement_value: number;
}> = {}) {
  const defaults = {
    name: 'Test Achievement',
    description: 'Test achievement description',
    icon: 'trophy',
    points_reward: 10,
    requirement_type: 'tasks_completed',
    requirement_value: 5
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO achievements (name, description, icon, points_reward, requirement_type, requirement_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.name, data.description, data.icon, data.points_reward, data.requirement_type, data.requirement_value);

  return testDb.prepare('SELECT * FROM achievements WHERE id = ?').get(result.lastInsertRowid) as any;
}
