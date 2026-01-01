import express from 'express';
import db from '../database/init';

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

// Enroll student in class
router.post('/enrollments', (req, res) => {
  try {
    const { student_id, class_id, parent_id } = req.body;

    if (!student_id || !class_id) {
      return res.status(400).json({ error: 'student_id and class_id are required' });
    }

    // If parent_id is provided, verify the child belongs to this parent
    if (parent_id) {
      const child: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(student_id);
      if (!child || child.parent_id !== parent_id) {
        return res.status(403).json({ error: 'You can only enroll your own children' });
      }
    }

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

// Create assignment
router.post('/assignments', (req, res) => {
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

// Update assignment
router.put('/assignments/:id', (req, res) => {
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

// Delete assignment
router.delete('/assignments/:id', (req, res) => {
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

// Submit assignment
router.post('/submissions', (req, res) => {
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

export default router;
