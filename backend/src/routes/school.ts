import express, { Response } from 'express';
import db from '../database/init';
import { authenticate, requireRole, verifyParentChild, optionalAuth, teacherOnly, parentOrAdmin, adminOnly } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all classes
router.get('/classes', (req, res) => {
  try {
    const classes = db.prepare('SELECT * FROM school_classes ORDER BY age_min ASC').all();
    res.json(classes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get class by ID
router.get('/classes/:id', (req, res) => {
  try {
    const classInfo = db.prepare('SELECT * FROM school_classes WHERE id = ?').get(req.params.id);
    if (!classInfo) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(classInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get students in a class
router.get('/classes/:id/students', (req, res) => {
  try {
    const students = db.prepare(`
      SELECT p.*, e.enrolled_at
      FROM profiles p
      JOIN school_enrollments e ON p.id = e.student_id
      WHERE e.class_id = ? AND p.type = 'child'
      ORDER BY p.name ASC
    `).all(req.params.id);
    res.json(students);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get parent's own children (for enrollment)
router.get('/parents/:parentId/children', (req, res) => {
  try {
    const children = db.prepare(`
      SELECT p.*,
             (SELECT COUNT(*) FROM school_enrollments WHERE student_id = p.id) as enrollment_count
      FROM profiles p
      WHERE p.parent_id = ? AND p.type = 'child'
      ORDER BY p.name ASC
    `).all(req.params.parentId);
    res.json(children);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Enroll student in class (parents and admin only, with parent-child verification)
router.post('/enrollments', parentOrAdmin, verifyParentChild('student_id'), (req: AuthRequest, res: Response) => {
  try {
    const { student_id, class_id } = req.body;

    if (!student_id || !class_id) {
      return res.status(400).json({ error: 'student_id and class_id are required' });
    }

    // Middleware already verified parent-child relationship if parent
    const result = db.prepare(`
      INSERT INTO school_enrollments (student_id, class_id)
      VALUES (?, ?)
    `).run(student_id, class_id);

    res.status(201).json({ id: result.lastInsertRowid, student_id, class_id });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Student already enrolled in this class' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get student's enrollments
router.get('/students/:studentId/enrollments', (req, res) => {
  try {
    const enrollments = db.prepare(`
      SELECT sc.*, e.enrolled_at
      FROM school_classes sc
      JOIN school_enrollments e ON sc.id = e.class_id
      WHERE e.student_id = ?
      ORDER BY sc.age_min ASC
    `).all(req.params.studentId);
    res.json(enrollments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Unenroll student from class (parents and admin only, with parent-child verification)
router.delete('/enrollments/:studentId/:classId', parentOrAdmin, verifyParentChild('studentId'), (req: AuthRequest, res: Response) => {
  try {
    const { studentId, classId } = req.params;

    // Middleware already verified parent-child relationship if parent
    const result = db.prepare(`
      DELETE FROM school_enrollments
      WHERE student_id = ? AND class_id = ?
    `).run(studentId, classId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({ message: 'Student unenrolled successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create assignment (teachers only)
router.post('/assignments', teacherOnly, (req: AuthRequest, res: Response) => {
  try {
    const {
      class_id,
      teacher_id,
      title,
      description,
      type,
      youtube_link,
      attachment_url,
      due_date
    } = req.body;

    if (!class_id || !teacher_id || !title) {
      return res.status(400).json({ error: 'class_id, teacher_id, and title are required' });
    }

    const result = db.prepare(`
      INSERT INTO school_assignments (
        class_id, teacher_id, title, description, type,
        youtube_link, attachment_url, due_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(class_id, teacher_id, title, description, type || 'homework',
           youtube_link, attachment_url, due_date);

    const newAssignment = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newAssignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get assignments for a class
router.get('/classes/:classId/assignments', (req, res) => {
  try {
    const assignments = db.prepare(`
      SELECT sa.*, p.name as teacher_name
      FROM school_assignments sa
      JOIN profiles p ON sa.teacher_id = p.id
      WHERE sa.class_id = ?
      ORDER BY sa.due_date DESC, sa.created_at DESC
    `).all(req.params.classId);
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get assignments for a student (based on their class enrollments)
router.get('/students/:studentId/assignments', (req, res) => {
  try {
    const assignments = db.prepare(`
      SELECT DISTINCT sa.*, p.name as teacher_name, sc.name as class_name,
             ss.id as submission_id,
             CASE WHEN ss.id IS NOT NULL THEN 1 ELSE 0 END as has_submitted,
             ss.status as submission_status,
             ss.submitted_at
      FROM school_assignments sa
      JOIN school_classes sc ON sa.class_id = sc.id
      JOIN school_enrollments e ON sc.id = e.class_id
      JOIN profiles p ON sa.teacher_id = p.id
      LEFT JOIN school_submissions ss ON sa.id = ss.assignment_id AND ss.student_id = ?
      WHERE e.student_id = ?
      ORDER BY sa.due_date DESC, sa.created_at DESC
    `).all(req.params.studentId, req.params.studentId);
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all assignments (for teachers to see everything)
router.get('/assignments', (req, res) => {
  try {
    const assignments = db.prepare(`
      SELECT sa.*, p.name as teacher_name, sc.name as class_name
      FROM school_assignments sa
      JOIN profiles p ON sa.teacher_id = p.id
      JOIN school_classes sc ON sa.class_id = sc.id
      ORDER BY sa.due_date DESC, sa.created_at DESC
    `).all();
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update assignment (teachers only)
router.put('/assignments/:id', teacherOnly, (req: AuthRequest, res: Response) => {
  try {
    const { title, description, type, youtube_link, attachment_url, due_date } = req.body;
    const { id } = req.params;

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type);
    }
    if (youtube_link !== undefined) {
      updates.push('youtube_link = ?');
      values.push(youtube_link);
    }
    if (attachment_url !== undefined) {
      updates.push('attachment_url = ?');
      values.push(attachment_url);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(due_date);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE school_assignments
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updatedAssignment = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(id);
    res.json(updatedAssignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete assignment (teachers only)
router.delete('/assignments/:id', teacherOnly, (req: AuthRequest, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM school_assignments WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit assignment (students and parents only, with verification)
router.post('/submissions', authenticate, requireRole(['child', 'parent']), verifyParentChild('student_id'), (req: AuthRequest, res) => {
  try {
    const { assignment_id, student_id, notes } = req.body;

    if (!assignment_id || !student_id) {
      return res.status(400).json({ error: 'assignment_id and student_id are required' });
    }

    const result = db.prepare(`
      INSERT INTO school_submissions (assignment_id, student_id, notes)
      VALUES (?, ?, ?)
      ON CONFLICT(assignment_id, student_id) DO UPDATE SET
        notes = ?,
        submitted_at = CURRENT_TIMESTAMP,
        status = 'submitted'
    `).run(assignment_id, student_id, notes, notes);

    const submission = db.prepare(`
      SELECT * FROM school_submissions
      WHERE assignment_id = ? AND student_id = ?
    `).get(assignment_id, student_id);

    res.status(201).json(submission);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get submissions for an assignment
router.get('/assignments/:assignmentId/submissions', (req, res) => {
  try {
    const submissions = db.prepare(`
      SELECT ss.*, p.name as student_name, p.avatar
      FROM school_submissions ss
      JOIN profiles p ON ss.student_id = p.id
      WHERE ss.assignment_id = ?
      ORDER BY ss.submitted_at DESC
    `).all(req.params.assignmentId);
    res.json(submissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get student's submission for an assignment
router.get('/assignments/:assignmentId/students/:studentId/submission', (req, res) => {
  try {
    const submission = db.prepare(`
      SELECT ss.*, p.name as student_name
      FROM school_submissions ss
      JOIN profiles p ON ss.student_id = p.id
      WHERE ss.assignment_id = ? AND ss.student_id = ?
    `).get(req.params.assignmentId, req.params.studentId);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json(submission);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add feedback to submission
router.post('/feedback', (req, res) => {
  try {
    const { submission_id, teacher_id, comment, rating } = req.body;

    if (!submission_id || !teacher_id || !comment) {
      return res.status(400).json({ error: 'submission_id, teacher_id, and comment are required' });
    }

    const result = db.prepare(`
      INSERT INTO school_feedback (submission_id, teacher_id, comment, rating)
      VALUES (?, ?, ?, ?)
    `).run(submission_id, teacher_id, comment, rating);

    // Update submission status to approved if rating is good
    if (rating === 'excellent' || rating === 'very_good' || rating === 'good') {
      db.prepare(`
        UPDATE school_submissions
        SET status = 'approved'
        WHERE id = ?
      `).run(submission_id);
    }

    const newFeedback = db.prepare('SELECT * FROM school_feedback WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newFeedback);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get feedback for a submission
router.get('/submissions/:submissionId/feedback', (req, res) => {
  try {
    const feedback = db.prepare(`
      SELECT sf.*, p.name as teacher_name
      FROM school_feedback sf
      JOIN profiles p ON sf.teacher_id = p.id
      WHERE sf.submission_id = ?
      ORDER BY sf.created_at DESC
    `).all(req.params.submissionId);
    res.json(feedback);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get student progress overview
router.get('/students/:studentId/progress', (req, res) => {
  try {
    const progress = db.prepare(`
      SELECT
        COUNT(DISTINCT sa.id) as total_assignments,
        COUNT(DISTINCT ss.id) as submitted_assignments,
        COUNT(DISTINCT CASE WHEN ss.status = 'approved' THEN ss.id END) as approved_assignments,
        COUNT(DISTINCT sf.id) as total_feedback
      FROM school_assignments sa
      JOIN school_classes sc ON sa.class_id = sc.id
      JOIN school_enrollments e ON sc.id = e.class_id
      LEFT JOIN school_submissions ss ON sa.id = ss.assignment_id AND ss.student_id = ?
      LEFT JOIN school_feedback sf ON ss.id = sf.submission_id
      WHERE e.student_id = ?
    `).get(req.params.studentId, req.params.studentId);

    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all students with their progress (for teachers)
router.get('/students/all/progress', (req, res) => {
  try {
    const studentsProgress = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.avatar,
        p.age,
        sc.name as class_name,
        COUNT(DISTINCT sa.id) as total_assignments,
        COUNT(DISTINCT ss.id) as submitted_assignments,
        COUNT(DISTINCT CASE WHEN ss.status = 'approved' THEN ss.id END) as approved_assignments
      FROM profiles p
      LEFT JOIN school_enrollments e ON p.id = e.student_id
      LEFT JOIN school_classes sc ON e.class_id = sc.id
      LEFT JOIN school_assignments sa ON sc.id = sa.class_id
      LEFT JOIN school_submissions ss ON sa.id = ss.assignment_id AND ss.student_id = p.id
      WHERE p.type = 'child'
      GROUP BY p.id, p.name, p.avatar, p.age, sc.name
      ORDER BY sc.age_min ASC, p.name ASC
    `).all();

    res.json(studentsProgress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== QUIZ ROUTES =====

// Create quiz questions for an assignment (teachers only)
router.post('/assignments/:assignmentId/quiz', teacherOnly, (req: AuthRequest, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Questions array is required' });
    }

    // Delete existing questions for this assignment first
    db.prepare('DELETE FROM quiz_questions WHERE assignment_id = ?').run(assignmentId);

    // Insert new questions
    const insertStmt = db.prepare(`
      INSERT INTO quiz_questions (assignment_id, question_text, option_a, option_b, option_c, option_d, correct_answer, points, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const createdQuestions = questions.map((q: any, index: number) => {
      const result = insertStmt.run(
        assignmentId,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c || null,
        q.option_d || null,
        q.correct_answer,
        q.points || 1,
        index
      );
      return { id: result.lastInsertRowid, ...q };
    });

    res.status(201).json(createdQuestions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get quiz questions for an assignment
router.get('/assignments/:assignmentId/quiz', (req, res) => {
  try {
    const questions = db.prepare(`
      SELECT * FROM quiz_questions
      WHERE assignment_id = ?
      ORDER BY order_index ASC
    `).all(req.params.assignmentId);

    res.json(questions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit quiz answers (students only)
router.post('/quiz/submit', authenticate, requireRole(['child', 'parent']), verifyParentChild('student_id'), (req: AuthRequest, res: Response) => {
  try {
    const { assignment_id, student_id, answers } = req.body;

    if (!assignment_id || !student_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'assignment_id, student_id, and answers array are required' });
    }

    // Get all questions for this assignment
    const questions: any[] = db.prepare('SELECT * FROM quiz_questions WHERE assignment_id = ?').all(assignment_id);

    // Process each answer
    const results = answers.map((answer: any) => {
      const question = questions.find(q => q.id === answer.question_id);
      if (!question) return null;

      const isCorrect = answer.selected_answer === question.correct_answer;

      // Insert or update answer
      db.prepare(`
        INSERT INTO student_quiz_answers (question_id, student_id, assignment_id, selected_answer, is_correct)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(question_id, student_id) DO UPDATE SET
          selected_answer = ?,
          is_correct = ?,
          submitted_at = CURRENT_TIMESTAMP
      `).run(
        answer.question_id,
        student_id,
        assignment_id,
        answer.selected_answer,
        isCorrect ? 1 : 0,
        answer.selected_answer,
        isCorrect ? 1 : 0
      );

      return {
        question_id: answer.question_id,
        is_correct: isCorrect
      };
    });

    // Calculate score
    const correctCount = results.filter(r => r && r.is_correct).length;
    const totalQuestions = questions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);

    res.json({
      score,
      correct: correctCount,
      total: totalQuestions,
      results: results.filter(r => r !== null)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get student's quiz results for an assignment
router.get('/assignments/:assignmentId/quiz/results/:studentId', (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;

    const answers = db.prepare(`
      SELECT qa.*, qq.question_text, qq.option_a, qq.option_b, qq.option_c, qq.option_d, qq.correct_answer, qq.points
      FROM student_quiz_answers qa
      JOIN quiz_questions qq ON qa.question_id = qq.id
      WHERE qa.assignment_id = ? AND qa.student_id = ?
      ORDER BY qq.order_index ASC
    `).all(assignmentId, studentId);

    if (answers.length === 0) {
      return res.json({ score: 0, correct: 0, total: 0, answers: [] });
    }

    const correctCount = answers.filter((a: any) => a.is_correct).length;
    const totalQuestions = answers.length;
    const score = Math.round((correctCount / totalQuestions) * 100);

    res.json({
      score,
      correct: correctCount,
      total: totalQuestions,
      answers
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
