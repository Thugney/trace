import { Router, Request, Response } from 'express';
import { db } from '../database/init';
import { sendPushNotification } from '../services/notifications';

const router = Router();

// ==================== QUIZ CATEGORIES ====================

// Get all quiz categories with theme configs
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = db.prepare(`
      SELECT * FROM quiz_categories ORDER BY display_name
    `).all();

    // Parse JSON fields
    const parsed = categories.map((cat: any) => ({
      ...cat,
      theme_config: JSON.parse(cat.theme_config || '{}'),
      input_config: JSON.parse(cat.input_config || '{}')
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching quiz categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single category by ID or name
router.get('/categories/:idOrName', (req: Request, res: Response) => {
  try {
    const { idOrName } = req.params;

    const category = db.prepare(`
      SELECT * FROM quiz_categories
      WHERE id = ? OR name = ?
    `).get(idOrName, idOrName) as any;

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      ...category,
      theme_config: JSON.parse(category.theme_config || '{}'),
      input_config: JSON.parse(category.input_config || '{}')
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// ==================== FAMILY QUIZZES CRUD ====================

// Get quizzes for a parent (created by them)
router.get('/parent/:parentId', (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;

    const quizzes = db.prepare(`
      SELECT fq.*,
             qc.display_name as category_name, qc.icon as category_icon,
             p.name as assigned_to_name, p.avatar as assigned_to_avatar, p.gender as assigned_to_gender,
             (SELECT COUNT(*) FROM family_quiz_questions WHERE quiz_id = fq.id) as question_count,
             (SELECT COUNT(*) FROM family_quiz_attempts WHERE quiz_id = fq.id) as attempt_count,
             (SELECT AVG(score_percentage) FROM family_quiz_attempts WHERE quiz_id = fq.id AND completed_at IS NOT NULL) as avg_score
      FROM family_quizzes fq
      JOIN quiz_categories qc ON fq.category_id = qc.id
      JOIN profiles p ON fq.assigned_to = p.id
      WHERE fq.created_by = ?
      ORDER BY fq.updated_at DESC
    `).all(parentId);

    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching parent quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get quizzes assigned to a child
router.get('/child/:childId', (req: Request, res: Response) => {
  try {
    const { childId } = req.params;

    // Get child's gender for theming
    const child = db.prepare('SELECT gender FROM profiles WHERE id = ?').get(childId) as any;
    const gender = child?.gender === 'female' ? 'girl' : 'boy';

    const quizzes = db.prepare(`
      SELECT fq.*,
             qc.display_name as category_name, qc.icon as category_icon,
             qc.theme_config, qc.input_config,
             (SELECT COUNT(*) FROM family_quiz_questions WHERE quiz_id = fq.id) as question_count,
             (SELECT COUNT(*) FROM family_quiz_attempts WHERE quiz_id = fq.id AND profile_id = ?) as my_attempts,
             (SELECT MAX(score_percentage) FROM family_quiz_attempts WHERE quiz_id = fq.id AND profile_id = ? AND completed_at IS NOT NULL) as best_score,
             (SELECT completed_at FROM family_quiz_attempts WHERE quiz_id = fq.id AND profile_id = ? ORDER BY completed_at DESC LIMIT 1) as last_attempt
      FROM family_quizzes fq
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE fq.assigned_to = ? AND fq.is_active = 1
      ORDER BY fq.created_at DESC
    `).all(childId, childId, childId, childId);

    // Parse theme config and apply gender-specific theme
    const parsed = quizzes.map((quiz: any) => {
      const themeConfig = JSON.parse(quiz.theme_config || '{}');
      const inputConfig = JSON.parse(quiz.input_config || '{}');

      return {
        ...quiz,
        theme: themeConfig[gender] || themeConfig.boy,
        input_config: inputConfig,
        theme_config: undefined // Don't expose full config
      };
    });

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching child quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get single quiz with questions (for parent editing)
router.get('/:quizId', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;

    const quiz = db.prepare(`
      SELECT fq.*,
             qc.display_name as category_name, qc.icon as category_icon,
             qc.name as category_name_key, qc.theme_config, qc.input_config,
             p.name as assigned_to_name, p.gender as assigned_to_gender
      FROM family_quizzes fq
      JOIN quiz_categories qc ON fq.category_id = qc.id
      JOIN profiles p ON fq.assigned_to = p.id
      WHERE fq.id = ?
    `).get(quizId) as any;

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = db.prepare(`
      SELECT * FROM family_quiz_questions
      WHERE quiz_id = ?
      ORDER BY order_index
    `).all(quizId);

    // Parse JSON fields
    const parsedQuestions = questions.map((q: any) => ({
      ...q,
      options: JSON.parse(q.options || '[]')
    }));

    res.json({
      ...quiz,
      theme_config: JSON.parse(quiz.theme_config || '{}'),
      input_config: JSON.parse(quiz.input_config || '{}'),
      questions: parsedQuestions
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// Create a new quiz
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      categoryId,
      createdBy,
      assignedTo,
      pointsPerCorrect = 10,
      starsPerCorrect = 0,
      bonusPoints = 20,
      timeLimitSeconds,
      passThreshold = 70,
      scheduleType = 'anytime',
      scheduleDays,
      isCompetition = false,
      competitionEndsAt,
      firstPlaceBonus = 50,
      secondPlaceBonus = 25,
      thirdPlaceBonus = 10
    } = req.body;

    if (!title || !categoryId || !createdBy || !assignedTo) {
      return res.status(400).json({ error: 'Title, category, creator, and assignee required' });
    }

    const result = db.prepare(`
      INSERT INTO family_quizzes (
        title, description, category_id, created_by, assigned_to,
        points_per_correct, stars_per_correct, bonus_points,
        time_limit_seconds, pass_threshold, schedule_type, schedule_days,
        is_competition, competition_ends_at, first_place_bonus, second_place_bonus, third_place_bonus
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description || null, categoryId, createdBy, assignedTo,
      pointsPerCorrect, starsPerCorrect, bonusPoints,
      timeLimitSeconds || null, passThreshold, scheduleType, scheduleDays || null,
      isCompetition ? 1 : 0, competitionEndsAt || null, firstPlaceBonus, secondPlaceBonus, thirdPlaceBonus
    );

    const quiz = db.prepare('SELECT * FROM family_quizzes WHERE id = ?').get(result.lastInsertRowid);

    // Notify the child about the new quiz
    sendPushNotification(assignedTo, {
      type: 'general',
      title: 'New Quiz Available! 📝',
      message: `You have a new ${title} quiz to try!`,
      icon: '🎓',
      data: { quizId: result.lastInsertRowid },
      url: '/quizzes'
    });

    res.json(quiz);
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// Update a quiz
router.put('/:quizId', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const updates = req.body;

    const allowedFields = [
      'title', 'description', 'category_id', 'assigned_to',
      'points_per_correct', 'stars_per_correct', 'bonus_points',
      'time_limit_seconds', 'pass_threshold', 'schedule_type', 'schedule_days',
      'is_active', 'is_competition', 'competition_ends_at',
      'first_place_bonus', 'second_place_bonus', 'third_place_bonus'
    ];

    const updateFields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        updateFields.push(`${snakeKey} = ?`);
        values.push(value);
      }
    }

    if (updateFields.length === 1) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(quizId);

    db.prepare(`
      UPDATE family_quizzes SET ${updateFields.join(', ')} WHERE id = ?
    `).run(...values);

    const quiz = db.prepare('SELECT * FROM family_quizzes WHERE id = ?').get(quizId);
    res.json(quiz);
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Delete a quiz
router.delete('/:quizId', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;

    // Questions and attempts will be deleted by CASCADE
    db.prepare('DELETE FROM family_quizzes WHERE id = ?').run(quizId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// ==================== QUIZ QUESTIONS ====================

// Add question to quiz
router.post('/:quizId/questions', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const {
      questionText,
      questionType = 'multiple_choice',
      questionImage,
      questionAudio,
      options, // array of option objects
      correctAnswer,
      hint,
      explanation,
      points = 10
    } = req.body;

    if (!questionText || !options || !correctAnswer) {
      return res.status(400).json({ error: 'Question text, options, and correct answer required' });
    }

    // Get max order_index
    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(order_index), -1) + 1 as next_order
      FROM family_quiz_questions WHERE quiz_id = ?
    `).get(quizId) as { next_order: number };

    const result = db.prepare(`
      INSERT INTO family_quiz_questions (
        quiz_id, question_text, question_type, question_image, question_audio,
        options, correct_answer, hint, explanation, points, order_index
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quizId, questionText, questionType, questionImage || null, questionAudio || null,
      JSON.stringify(options), correctAnswer, hint || null, explanation || null,
      points, maxOrder.next_order
    );

    const question = db.prepare('SELECT * FROM family_quiz_questions WHERE id = ?').get(result.lastInsertRowid) as any;

    res.json({
      ...question,
      options: JSON.parse(question.options)
    });
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// Update question
router.put('/questions/:questionId', (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const updates = req.body;

    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.questionText !== undefined) {
      updateFields.push('question_text = ?');
      values.push(updates.questionText);
    }
    if (updates.questionType !== undefined) {
      updateFields.push('question_type = ?');
      values.push(updates.questionType);
    }
    if (updates.questionImage !== undefined) {
      updateFields.push('question_image = ?');
      values.push(updates.questionImage);
    }
    if (updates.questionAudio !== undefined) {
      updateFields.push('question_audio = ?');
      values.push(updates.questionAudio);
    }
    if (updates.options !== undefined) {
      updateFields.push('options = ?');
      values.push(JSON.stringify(updates.options));
    }
    if (updates.correctAnswer !== undefined) {
      updateFields.push('correct_answer = ?');
      values.push(updates.correctAnswer);
    }
    if (updates.hint !== undefined) {
      updateFields.push('hint = ?');
      values.push(updates.hint);
    }
    if (updates.explanation !== undefined) {
      updateFields.push('explanation = ?');
      values.push(updates.explanation);
    }
    if (updates.points !== undefined) {
      updateFields.push('points = ?');
      values.push(updates.points);
    }
    if (updates.orderIndex !== undefined) {
      updateFields.push('order_index = ?');
      values.push(updates.orderIndex);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(questionId);

    db.prepare(`
      UPDATE family_quiz_questions SET ${updateFields.join(', ')} WHERE id = ?
    `).run(...values);

    const question = db.prepare('SELECT * FROM family_quiz_questions WHERE id = ?').get(questionId) as any;

    res.json({
      ...question,
      options: JSON.parse(question.options)
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question
router.delete('/questions/:questionId', (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;

    db.prepare('DELETE FROM family_quiz_questions WHERE id = ?').run(questionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Reorder questions
router.put('/:quizId/questions/reorder', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const { questionIds } = req.body; // array of question IDs in new order

    if (!Array.isArray(questionIds)) {
      return res.status(400).json({ error: 'questionIds array required' });
    }

    const updateOrder = db.prepare(`
      UPDATE family_quiz_questions SET order_index = ? WHERE id = ? AND quiz_id = ?
    `);

    for (let i = 0; i < questionIds.length; i++) {
      updateOrder.run(i, questionIds[i], quizId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering questions:', error);
    res.status(500).json({ error: 'Failed to reorder questions' });
  }
});

// ==================== QUIZ ATTEMPTS (PLAYING) ====================

// Start a quiz attempt
router.post('/:quizId/start', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const { profileId } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID required' });
    }

    // Get quiz with questions
    const quiz = db.prepare(`
      SELECT fq.*, qc.theme_config, qc.input_config
      FROM family_quizzes fq
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE fq.id = ?
    `).get(quizId) as any;

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get child's gender for theming
    const child = db.prepare('SELECT gender FROM profiles WHERE id = ?').get(profileId) as any;
    const gender = child?.gender === 'female' ? 'girl' : 'boy';

    const questions = db.prepare(`
      SELECT id, question_text, question_type, question_image, question_audio,
             options, hint, points, order_index
      FROM family_quiz_questions
      WHERE quiz_id = ?
      ORDER BY order_index
    `).all(quizId);

    if (questions.length === 0) {
      return res.status(400).json({ error: 'Quiz has no questions' });
    }

    // Create attempt record
    const result = db.prepare(`
      INSERT INTO family_quiz_attempts (quiz_id, profile_id, total_questions)
      VALUES (?, ?, ?)
    `).run(quizId, profileId, questions.length);

    // Parse and prepare questions (don't include correct answer!)
    const parsedQuestions = questions.map((q: any) => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      questionImage: q.question_image,
      questionAudio: q.question_audio,
      options: JSON.parse(q.options),
      hint: q.hint,
      points: q.points,
      orderIndex: q.order_index
    }));

    const themeConfig = JSON.parse(quiz.theme_config || '{}');

    res.json({
      attemptId: result.lastInsertRowid,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        pointsPerCorrect: quiz.points_per_correct,
        starsPerCorrect: quiz.stars_per_correct,
        bonusPoints: quiz.bonus_points,
        timeLimitSeconds: quiz.time_limit_seconds,
        passThreshold: quiz.pass_threshold,
        isCompetition: quiz.is_competition === 1
      },
      theme: themeConfig[gender] || themeConfig.boy,
      questions: parsedQuestions,
      totalQuestions: questions.length
    });
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
});

// Submit answer for a question
router.post('/attempts/:attemptId/answer', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selectedAnswer, timeTakenSeconds } = req.body;

    if (!questionId || selectedAnswer === undefined) {
      return res.status(400).json({ error: 'Question ID and answer required' });
    }

    // Get the question to check answer
    const question = db.prepare(`
      SELECT correct_answer, explanation, points FROM family_quiz_questions WHERE id = ?
    `).get(questionId) as any;

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const isCorrect = selectedAnswer === question.correct_answer;

    // Save the answer
    db.prepare(`
      INSERT INTO family_quiz_answers (attempt_id, question_id, selected_answer, is_correct, time_taken_seconds)
      VALUES (?, ?, ?, ?, ?)
    `).run(attemptId, questionId, selectedAnswer, isCorrect ? 1 : 0, timeTakenSeconds || null);

    // Update attempt stats
    if (isCorrect) {
      db.prepare(`
        UPDATE family_quiz_attempts
        SET correct_answers = correct_answers + 1
        WHERE id = ?
      `).run(attemptId);
    } else {
      db.prepare(`
        UPDATE family_quiz_attempts
        SET wrong_answers = wrong_answers + 1
        WHERE id = ?
      `).run(attemptId);
    }

    res.json({
      isCorrect,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      points: isCorrect ? question.points : 0
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// Complete quiz attempt
router.post('/attempts/:attemptId/complete', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { timeTakenSeconds } = req.body;

    // Get attempt details
    const attempt = db.prepare(`
      SELECT fa.*, fq.points_per_correct, fq.stars_per_correct, fq.bonus_points,
             fq.pass_threshold, fq.is_competition, fq.first_place_bonus, fq.second_place_bonus, fq.third_place_bonus,
             fq.id as quiz_id, fq.created_by
      FROM family_quiz_attempts fa
      JOIN family_quizzes fq ON fa.quiz_id = fq.id
      WHERE fa.id = ?
    `).get(attemptId) as any;

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Calculate score
    const scorePercentage = Math.round((attempt.correct_answers / attempt.total_questions) * 100);
    const passed = scorePercentage >= attempt.pass_threshold;

    // Calculate points earned
    let pointsEarned = attempt.correct_answers * attempt.points_per_correct;
    let starsEarned = attempt.correct_answers * attempt.stars_per_correct;

    // Add bonus if passed
    if (passed) {
      pointsEarned += attempt.bonus_points;
    }

    // Handle competition ranking
    let competitionRank = null;
    let competitionBonus = 0;

    if (attempt.is_competition) {
      // Count completed attempts before this one
      const previousAttempts = db.prepare(`
        SELECT COUNT(*) as count FROM family_quiz_attempts
        WHERE quiz_id = ? AND completed_at IS NOT NULL AND passed = 1 AND id < ?
      `).get(attempt.quiz_id, attemptId) as { count: number };

      if (passed) {
        competitionRank = previousAttempts.count + 1;

        if (competitionRank === 1) {
          competitionBonus = attempt.first_place_bonus;
        } else if (competitionRank === 2) {
          competitionBonus = attempt.second_place_bonus;
        } else if (competitionRank === 3) {
          competitionBonus = attempt.third_place_bonus;
        }

        pointsEarned += competitionBonus;
      }
    }

    // Update attempt
    db.prepare(`
      UPDATE family_quiz_attempts
      SET completed_at = CURRENT_TIMESTAMP,
          score_percentage = ?,
          points_earned = ?,
          stars_earned = ?,
          time_taken_seconds = ?,
          passed = ?,
          competition_rank = ?,
          bonus_awarded = ?
      WHERE id = ?
    `).run(scorePercentage, pointsEarned, starsEarned, timeTakenSeconds || null,
           passed ? 1 : 0, competitionRank, competitionBonus, attemptId);

    // Award points to progress
    if (pointsEarned > 0 || starsEarned > 0) {
      db.prepare(`
        INSERT INTO progress (profile_id, points_earned, stars_earned)
        VALUES (?, ?, ?)
      `).run(attempt.profile_id, pointsEarned, starsEarned);
    }

    // Notify parent about completion
    const child = db.prepare('SELECT name FROM profiles WHERE id = ?').get(attempt.profile_id) as any;

    sendPushNotification(attempt.created_by, {
      type: 'achievement',
      title: passed ? 'Quiz Passed! 🎉' : 'Quiz Completed',
      message: `${child?.name || 'Your child'} scored ${scorePercentage}% on their quiz!`,
      icon: passed ? '⭐' : '📝',
      data: { attemptId, quizId: attempt.quiz_id, score: scorePercentage },
      url: '/quizzes'
    });

    res.json({
      completed: true,
      scorePercentage,
      passed,
      pointsEarned,
      starsEarned,
      correctAnswers: attempt.correct_answers,
      totalQuestions: attempt.total_questions,
      competitionRank,
      competitionBonus,
      timeTakenSeconds
    });
  } catch (error) {
    console.error('Error completing quiz:', error);
    res.status(500).json({ error: 'Failed to complete quiz' });
  }
});

// Get quiz attempt history for a profile
router.get('/attempts/profile/:profileId', (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { limit = 20 } = req.query;

    const attempts = db.prepare(`
      SELECT fa.*, fq.title as quiz_title, qc.icon as category_icon
      FROM family_quiz_attempts fa
      JOIN family_quizzes fq ON fa.quiz_id = fq.id
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE fa.profile_id = ?
      ORDER BY fa.started_at DESC
      LIMIT ?
    `).all(profileId, limit);

    res.json(attempts);
  } catch (error) {
    console.error('Error fetching attempts:', error);
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

// Get detailed attempt results
router.get('/attempts/:attemptId', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const attempt = db.prepare(`
      SELECT fa.*, fq.title as quiz_title, fq.description as quiz_description,
             qc.icon as category_icon, qc.display_name as category_name
      FROM family_quiz_attempts fa
      JOIN family_quizzes fq ON fa.quiz_id = fq.id
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE fa.id = ?
    `).get(attemptId) as any;

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Get all answers with question details
    const answers = db.prepare(`
      SELECT fqa.*, fqq.question_text, fqq.options, fqq.correct_answer, fqq.explanation
      FROM family_quiz_answers fqa
      JOIN family_quiz_questions fqq ON fqa.question_id = fqq.id
      WHERE fqa.attempt_id = ?
      ORDER BY fqq.order_index
    `).all(attemptId);

    const parsedAnswers = answers.map((a: any) => ({
      ...a,
      options: JSON.parse(a.options)
    }));

    res.json({
      ...attempt,
      answers: parsedAnswers
    });
  } catch (error) {
    console.error('Error fetching attempt details:', error);
    res.status(500).json({ error: 'Failed to fetch attempt details' });
  }
});

// ==================== COMPETITION LEADERBOARD ====================

// Get competition leaderboard for a quiz
router.get('/:quizId/leaderboard', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;

    const leaderboard = db.prepare(`
      SELECT fa.*, p.name, p.avatar
      FROM family_quiz_attempts fa
      JOIN profiles p ON fa.profile_id = p.id
      WHERE fa.quiz_id = ? AND fa.completed_at IS NOT NULL AND fa.passed = 1
      ORDER BY fa.competition_rank ASC, fa.time_taken_seconds ASC
      LIMIT 10
    `).all(quizId);

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ==================== QUIZ STATS ====================

// Get quiz statistics for a parent
router.get('/stats/parent/:parentId', (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;

    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT fq.id) as total_quizzes,
        COUNT(DISTINCT fa.id) as total_attempts,
        AVG(fa.score_percentage) as avg_score,
        SUM(fa.points_earned) as total_points_awarded,
        SUM(fa.stars_earned) as total_stars_awarded,
        COUNT(CASE WHEN fa.passed = 1 THEN 1 END) as passed_attempts,
        COUNT(CASE WHEN fa.completed_at IS NOT NULL THEN 1 END) as completed_attempts
      FROM family_quizzes fq
      LEFT JOIN family_quiz_attempts fa ON fq.id = fa.quiz_id
      WHERE fq.created_by = ?
    `).get(parentId);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching parent stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get quiz statistics for a child
router.get('/stats/child/:childId', (req: Request, res: Response) => {
  try {
    const { childId } = req.params;

    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT fq.id) as available_quizzes,
        COUNT(fa.id) as total_attempts,
        AVG(fa.score_percentage) as avg_score,
        SUM(fa.points_earned) as total_points_earned,
        SUM(fa.stars_earned) as total_stars_earned,
        COUNT(CASE WHEN fa.passed = 1 THEN 1 END) as quizzes_passed,
        MAX(fa.score_percentage) as best_score,
        COUNT(CASE WHEN fa.competition_rank = 1 THEN 1 END) as first_places
      FROM family_quizzes fq
      LEFT JOIN family_quiz_attempts fa ON fq.id = fa.quiz_id AND fa.profile_id = ?
      WHERE fq.assigned_to = ? AND fq.is_active = 1
    `).get(childId, childId);

    // Get per-category breakdown
    const byCategory = db.prepare(`
      SELECT qc.display_name, qc.icon,
             COUNT(fa.id) as attempts,
             AVG(fa.score_percentage) as avg_score,
             SUM(fa.points_earned) as points_earned
      FROM quiz_categories qc
      LEFT JOIN family_quizzes fq ON qc.id = fq.category_id AND fq.assigned_to = ?
      LEFT JOIN family_quiz_attempts fa ON fq.id = fa.quiz_id AND fa.profile_id = ?
      GROUP BY qc.id
      HAVING attempts > 0
      ORDER BY attempts DESC
    `).all(childId, childId);

    res.json({ overall: stats, byCategory });
  } catch (error) {
    console.error('Error fetching child stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
