import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../database/init';
import { authenticate, requireRole, verifyParentChild, optionalAuth, teacherOnly, parentOrAdmin, parentOrAdminOrTeacher, adminOnly } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

// File upload configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../data/uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `assignment-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, Word documents, and images are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// File upload endpoint
router.post('/upload', authenticate, requireRole(['teacher', 'admin']), upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return the URL path for the uploaded file
    const fileUrl = `/api/school/files/${req.file.filename}`;

    res.json({
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files
router.get('/files/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Security: prevent directory traversal
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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

// Get teacher's assigned class
router.get('/teacher/my-class', authenticate, requireRole(['teacher']), (req: AuthRequest, res: Response) => {
  try {
    const teacher: any = db.prepare(`
      SELECT p.assigned_class_id, sc.name as class_name, sc.description, sc.age_min, sc.age_max
      FROM profiles p
      LEFT JOIN school_classes sc ON p.assigned_class_id = sc.id
      WHERE p.id = ?
    `).get(req.profile?.id);

    if (!teacher?.assigned_class_id) {
      return res.status(404).json({ error: 'No class assigned to this teacher' });
    }

    res.json({
      class_id: teacher.assigned_class_id,
      class_name: teacher.class_name,
      description: teacher.description,
      age_min: teacher.age_min,
      age_max: teacher.age_max
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get students for teacher's class (for enrollment management)
router.get('/teacher/students', authenticate, requireRole(['teacher']), (req: AuthRequest, res: Response) => {
  try {
    const teacher: any = db.prepare('SELECT assigned_class_id FROM profiles WHERE id = ?').get(req.profile?.id);

    if (!teacher?.assigned_class_id) {
      return res.json([]); // No class assigned, return empty
    }

    // Get all children enrolled in teacher's class
    const students = db.prepare(`
      SELECT p.*, e.enrolled_at, e.class_id
      FROM profiles p
      JOIN school_enrollments e ON p.id = e.student_id
      WHERE e.class_id = ? AND p.type = 'child'
      ORDER BY p.name ASC
    `).all(teacher.assigned_class_id);

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

// Enroll student in class (parents, teachers, and admin - teachers can move students between classes)
router.post('/enrollments', parentOrAdminOrTeacher, verifyParentChild('student_id'), (req: AuthRequest, res: Response) => {
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

// Unenroll student from class (parents, teachers, and admin - teachers can move students between classes)
router.delete('/enrollments/:studentId/:classId', parentOrAdminOrTeacher, verifyParentChild('studentId'), (req: AuthRequest, res: Response) => {
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

// Get all students with their progress (for teachers - filtered by assigned class)
// NOTE: This route MUST come before /students/:studentId/progress to avoid matching "all" as studentId
router.get('/students/all/progress', authenticate, (req: AuthRequest, res: Response) => {
  try {
    let classFilter = '';
    let params: any[] = [];

    // Teachers only see students from their assigned class
    if (req.profile?.type === 'teacher') {
      const teacher: any = db.prepare('SELECT assigned_class_id FROM profiles WHERE id = ?').get(req.profile.id);
      if (teacher?.assigned_class_id) {
        classFilter = 'AND e.class_id = ?';
        params.push(teacher.assigned_class_id);
      }
    }

    const studentsProgress = db.prepare(`
      SELECT
        p.id as student_id,
        p.name as student_name,
        p.avatar,
        p.age,
        sc.name as class_name,
        sc.id as class_id,
        COUNT(DISTINCT sa.id) as total_assignments,
        COUNT(DISTINCT ss.id) as submitted_count,
        COUNT(DISTINCT CASE WHEN ss.status = 'approved' THEN ss.id END) as approved_count,
        COUNT(DISTINCT CASE WHEN ss.status = 'needs_revision' THEN ss.id END) as needs_revision_count,
        COUNT(DISTINCT sa.id) - COUNT(DISTINCT ss.id) as pending_count,
        CASE
          WHEN COUNT(DISTINCT sa.id) > 0
          THEN ROUND(COUNT(DISTINCT ss.id) * 100.0 / COUNT(DISTINCT sa.id), 0)
          ELSE 0
        END as completion_rate
      FROM profiles p
      LEFT JOIN school_enrollments e ON p.id = e.student_id
      LEFT JOIN school_classes sc ON e.class_id = sc.id
      LEFT JOIN school_assignments sa ON sc.id = sa.class_id
      LEFT JOIN school_submissions ss ON sa.id = ss.assignment_id AND ss.student_id = p.id
      WHERE p.type = 'child' ${classFilter}
      GROUP BY p.id, p.name, p.avatar, p.age, sc.name, sc.id
      ORDER BY sc.age_min ASC, p.name ASC
    `).all(...params);

    res.json(studentsProgress);
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
// Accessible by: student (own results), parent (children's results), teacher, admin
router.get('/assignments/:assignmentId/quiz/results/:studentId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { assignmentId, studentId } = req.params;
    const studentIdNum = parseInt(studentId);

    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Authorization check
    if (req.profile.type === 'child') {
      // Students can only view their own results
      if (req.profile.id !== studentIdNum) {
        return res.status(403).json({ error: 'Access denied: You can only view your own results' });
      }
    } else if (req.profile.type === 'parent') {
      // Parents can only view their children's results
      const child: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(studentIdNum);
      if (!child || child.parent_id !== req.profile.id) {
        return res.status(403).json({ error: 'Access denied: You can only view your own children\'s results' });
      }
    } else if (req.profile.type === 'teacher') {
      // Teachers can view results for students in their classes
      const enrollment: any = db.prepare(`
        SELECT e.id
        FROM school_enrollments e
        JOIN school_assignments sa ON e.class_id = sa.class_id
        WHERE e.student_id = ? AND sa.id = ? AND sa.teacher_id = ?
      `).get(studentIdNum, assignmentId, req.profile.id);

      if (!enrollment) {
        return res.status(403).json({ error: 'Access denied: You can only view results for students in your classes' });
      }
    }
    // Admin has access to all results (no check needed)

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

// Get all quiz results for a student across all assignments (for parents)
router.get('/students/:studentId/quiz-results', authenticate, verifyParentChild('studentId'), (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;

    const results = db.prepare(`
      SELECT
        sa.id as assignment_id,
        sa.title as assignment_title,
        sa.type,
        sc.name as class_name,
        COUNT(DISTINCT qq.id) as total_questions,
        COUNT(DISTINCT CASE WHEN sqa.is_correct = 1 THEN sqa.id END) as correct_answers,
        ROUND(CAST(COUNT(DISTINCT CASE WHEN sqa.is_correct = 1 THEN sqa.id END) AS FLOAT) / COUNT(DISTINCT qq.id) * 100) as score_percentage,
        MAX(sqa.submitted_at) as submitted_at
      FROM school_assignments sa
      JOIN school_classes sc ON sa.class_id = sc.id
      JOIN school_enrollments e ON sc.id = e.class_id
      LEFT JOIN quiz_questions qq ON sa.id = qq.assignment_id
      LEFT JOIN student_quiz_answers sqa ON qq.id = sqa.question_id AND sqa.student_id = ?
      WHERE e.student_id = ? AND qq.id IS NOT NULL
      GROUP BY sa.id, sa.title, sa.type, sc.name
      HAVING COUNT(DISTINCT sqa.id) > 0
      ORDER BY submitted_at DESC
    `).all(studentId, studentId);

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GAMIFICATION ROUTES
// ============================================

// Helper function to check and auto-award achievements
const checkAndAwardAchievements = (studentId: number) => {
  try {
    // Get student stats
    const stats: any = db.prepare(`
      SELECT
        COUNT(DISTINCT ss.id) as completed_assignments,
        COUNT(DISTINCT CASE WHEN ss.status = 'approved' THEN ss.id END) as approved_assignments,
        COUNT(DISTINCT CASE WHEN sa.type = 'psalm' AND ss.status = 'approved' THEN ss.id END) as psalm_completed,
        COUNT(DISTINCT CASE WHEN sa.type = 'alphabet' AND ss.status = 'approved' THEN ss.id END) as alphabet_completed,
        COUNT(DISTINCT CASE WHEN sa.type = 'video' AND ss.status = 'approved' THEN ss.id END) as video_completed
      FROM school_submissions ss
      JOIN school_assignments sa ON ss.assignment_id = sa.id
      WHERE ss.student_id = ?
    `).get(studentId);

    // Get quiz stats
    const quizStats: any = db.prepare(`
      SELECT
        COUNT(DISTINCT assignment_id) as quizzes_taken,
        MAX(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as has_perfect_score
      FROM student_quiz_answers
      WHERE student_id = ?
    `).get(studentId);

    // Check for 100% quiz score
    const perfectQuiz: any = db.prepare(`
      SELECT assignment_id,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
        COUNT(*) as total
      FROM student_quiz_answers
      WHERE student_id = ?
      GROUP BY assignment_id
      HAVING correct = total
    `).all(studentId);

    // Get student's current points
    const studentPoints: any = db.prepare(`
      SELECT COALESCE(points, 0) as points FROM student_school_points WHERE student_id = ?
    `).get(studentId);
    const currentPoints = studentPoints?.points || 0;

    // Get all achievements
    const achievements: any[] = db.prepare('SELECT * FROM school_achievements').all();

    // Check each achievement
    const awardAchievement = db.prepare(`
      INSERT OR IGNORE INTO student_achievements (student_id, achievement_id)
      VALUES (?, ?)
    `);

    const newlyAwarded: any[] = [];

    for (const ach of achievements) {
      let shouldAward = false;

      switch (ach.requirement_type) {
        case 'assignments_completed':
          shouldAward = stats.approved_assignments >= ach.requirement_value;
          break;
        case 'quiz_score':
          shouldAward = perfectQuiz.length > 0 && ach.requirement_value === 100;
          break;
        case 'special':
          // Check specific special achievements
          if (ach.name === 'Psalm Singer') {
            shouldAward = stats.psalm_completed >= ach.requirement_value;
          } else if (ach.name === 'Geez Scholar') {
            shouldAward = stats.alphabet_completed >= ach.requirement_value;
          } else if (ach.name === 'Video Watcher') {
            shouldAward = stats.video_completed >= ach.requirement_value;
          } else if (ach.name === 'Rising Star') {
            shouldAward = currentPoints >= 50;
          } else if (ach.name === 'Super Student') {
            shouldAward = currentPoints >= 100;
          } else if (ach.name === 'Church Scholar') {
            shouldAward = currentPoints >= 200;
          }
          break;
      }

      if (shouldAward) {
        const result = awardAchievement.run(studentId, ach.id);
        if (result.changes > 0) {
          newlyAwarded.push(ach);
          // Add achievement points
          db.prepare(`
            INSERT INTO student_school_points (student_id, points) VALUES (?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
              points = points + ?,
              level = CASE WHEN points + ? >= 200 THEN 5
                          WHEN points + ? >= 100 THEN 4
                          WHEN points + ? >= 50 THEN 3
                          WHEN points + ? >= 20 THEN 2
                          ELSE 1 END,
              updated_at = CURRENT_TIMESTAMP
          `).run(studentId, ach.points, ach.points, ach.points, ach.points, ach.points, ach.points);
        }
      }
    }

    return newlyAwarded;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
};

// Get all available achievements
router.get('/achievements', (req, res) => {
  try {
    const achievements = db.prepare('SELECT * FROM school_achievements ORDER BY points ASC').all();
    res.json(achievements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get student's earned achievements
router.get('/students/:studentId/achievements', (req, res) => {
  try {
    const { studentId } = req.params;

    // First check and award any new achievements
    checkAndAwardAchievements(Number(studentId));

    const achievements = db.prepare(`
      SELECT sa.*, sea.earned_at, p.name as awarded_by_name, sea.notes
      FROM student_achievements sea
      JOIN school_achievements sa ON sea.achievement_id = sa.id
      LEFT JOIN profiles p ON sea.awarded_by = p.id
      WHERE sea.student_id = ?
      ORDER BY sea.earned_at DESC
    `).all(studentId);

    res.json(achievements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Award achievement manually (teacher/admin only)
router.post('/achievements/award', teacherOnly, (req: AuthRequest, res: Response) => {
  try {
    const { student_id, achievement_id, notes } = req.body;

    if (!student_id || !achievement_id) {
      return res.status(400).json({ error: 'student_id and achievement_id are required' });
    }

    // Check if already awarded
    const existing: any = db.prepare(`
      SELECT * FROM student_achievements WHERE student_id = ? AND achievement_id = ?
    `).get(student_id, achievement_id);

    if (existing) {
      return res.status(409).json({ error: 'Achievement already awarded to this student' });
    }

    // Get achievement points
    const achievement: any = db.prepare('SELECT points FROM school_achievements WHERE id = ?').get(achievement_id);
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    // Award the achievement
    db.prepare(`
      INSERT INTO student_achievements (student_id, achievement_id, awarded_by, notes)
      VALUES (?, ?, ?, ?)
    `).run(student_id, achievement_id, req.profile?.id, notes);

    // Add points
    db.prepare(`
      INSERT INTO student_school_points (student_id, points) VALUES (?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        points = points + ?,
        level = CASE WHEN points + ? >= 200 THEN 5
                    WHEN points + ? >= 100 THEN 4
                    WHEN points + ? >= 50 THEN 3
                    WHEN points + ? >= 20 THEN 2
                    ELSE 1 END,
        updated_at = CURRENT_TIMESTAMP
    `).run(student_id, achievement.points, achievement.points, achievement.points, achievement.points, achievement.points, achievement.points);

    res.status(201).json({ message: 'Achievement awarded successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get student's points and level
router.get('/students/:studentId/points', (req, res) => {
  try {
    const { studentId } = req.params;

    let points: any = db.prepare(`
      SELECT * FROM student_school_points WHERE student_id = ?
    `).get(studentId);

    if (!points) {
      points = { student_id: studentId, points: 0, level: 1 };
    }

    // Get level name
    const levelNames: Record<number, string> = {
      1: 'Beginner',
      2: 'Learner',
      3: 'Achiever',
      4: 'Expert',
      5: 'Master'
    };
    points.level_name = levelNames[points.level] || 'Beginner';

    // Calculate points to next level
    const levelThresholds = [0, 20, 50, 100, 200];
    const nextLevel = Math.min(points.level + 1, 5);
    points.points_to_next_level = levelThresholds[nextLevel - 1] - points.points;
    if (points.points_to_next_level < 0) points.points_to_next_level = 0;

    res.json(points);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add points to student (teacher/admin only)
router.post('/students/:studentId/points', teacherOnly, (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { points, reason } = req.body;

    if (!points || typeof points !== 'number') {
      return res.status(400).json({ error: 'Points (number) required' });
    }

    db.prepare(`
      INSERT INTO student_school_points (student_id, points) VALUES (?, ?)
      ON CONFLICT(student_id) DO UPDATE SET
        points = points + ?,
        level = CASE WHEN points + ? >= 200 THEN 5
                    WHEN points + ? >= 100 THEN 4
                    WHEN points + ? >= 50 THEN 3
                    WHEN points + ? >= 20 THEN 2
                    ELSE 1 END,
        updated_at = CURRENT_TIMESTAMP
    `).run(studentId, points, points, points, points, points, points);

    // Check for new achievements after adding points
    const newAchievements = checkAndAwardAchievements(Number(studentId));

    const updated: any = db.prepare('SELECT * FROM student_school_points WHERE student_id = ?').get(studentId);

    res.json({
      ...updated,
      new_achievements: newAchievements,
      reason
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get leaderboard (top students by points)
router.get('/leaderboard', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const leaderboard = db.prepare(`
      SELECT
        p.id,
        p.name,
        p.avatar,
        COALESCE(ssp.points, 0) as points,
        COALESCE(ssp.level, 1) as level,
        COUNT(DISTINCT sa.id) as achievements_count
      FROM profiles p
      LEFT JOIN student_school_points ssp ON p.id = ssp.student_id
      LEFT JOIN student_achievements sa ON p.id = sa.student_id
      WHERE p.type = 'child'
      GROUP BY p.id
      ORDER BY points DESC, achievements_count DESC
      LIMIT ?
    `).all(limit);

    res.json(leaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN: TEACHER CLASS ASSIGNMENT
// ============================================

// Assign teacher to a class (admin only)
router.post('/teachers/:teacherId/assign-class', adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const { teacherId } = req.params;
    const { class_id } = req.body;

    // Verify teacher exists and is a teacher
    const teacher: any = db.prepare('SELECT id, type FROM profiles WHERE id = ?').get(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    if (teacher.type !== 'teacher') {
      return res.status(400).json({ error: 'Profile is not a teacher' });
    }

    // Verify class exists
    if (class_id) {
      const classExists = db.prepare('SELECT id FROM school_classes WHERE id = ?').get(class_id);
      if (!classExists) {
        return res.status(404).json({ error: 'Class not found' });
      }
    }

    // Update teacher's assigned class
    db.prepare('UPDATE profiles SET assigned_class_id = ? WHERE id = ?').run(class_id || null, teacherId);

    res.json({ message: 'Teacher assigned to class successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all teachers with their assigned classes (admin only)
router.get('/teachers', adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const teachers = db.prepare(`
      SELECT p.id, p.name, p.avatar, p.assigned_class_id, sc.name as class_name
      FROM profiles p
      LEFT JOIN school_classes sc ON p.assigned_class_id = sc.id
      WHERE p.type = 'teacher'
      ORDER BY p.name ASC
    `).all();

    res.json(teachers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
