import { Router, Response } from 'express';
import { db } from '../database/init';
import { authenticate, type AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to check if profile is guardian of student
function isGuardianOf(guardianId: number, studentId: number): boolean {
  const link = db.prepare('SELECT 1 FROM guardian_students WHERE guardian_id = ? AND student_id = ?').get(guardianId, studentId);
  return !!link;
}

// ==================== SUBJECTS ====================

// Get subjects for a student
router.get('/subjects', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;

    if (profile.type === 'parent') {
      if (!studentId) {
        return res.status(400).json({ error: 'student_id required for parents' });
      }
      if (!isGuardianOf(profile.id, studentId)) {
        return res.status(403).json({ error: 'Access denied: not guardian of this student' });
      }
      const subjects = db.prepare(`
        SELECT rs.*,
          (SELECT COUNT(*) FROM regular_school_homework WHERE subject_id = rs.id AND status = 'pending') as pending_count,
          (SELECT COUNT(*) FROM regular_school_homework WHERE subject_id = rs.id AND status = 'completed') as completed_count
        FROM regular_school_subjects rs
        WHERE rs.student_id = ?
        ORDER BY rs.name
      `).all(studentId);
      return res.json(subjects);
    }

    if (profile.type === 'child') {
      const subjects = db.prepare(`
        SELECT rs.*,
          (SELECT COUNT(*) FROM regular_school_homework WHERE subject_id = rs.id AND status = 'pending') as pending_count,
          (SELECT COUNT(*) FROM regular_school_homework WHERE subject_id = rs.id AND status = 'completed') as completed_count
        FROM regular_school_subjects rs
        WHERE rs.student_id = ?
        ORDER BY rs.name
      `).all(profile.id);
      return res.json(subjects);
    }

    return res.status(403).json({ error: 'Only parents and children can access regular school' });
  } catch (error: any) {
    console.error('[RegularSchool] Get subjects error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a subject
router.post('/subjects', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (profile.type !== 'parent') {
      return res.status(403).json({ error: 'Only parents can create subjects' });
    }

    const { student_id, name, icon, color } = req.body;
    if (!student_id || !name) {
      return res.status(400).json({ error: 'student_id and name are required' });
    }

    if (!isGuardianOf(profile.id, Number(student_id))) {
      return res.status(403).json({ error: 'Access denied: not guardian of this student' });
    }

    const result = db.prepare(`
      INSERT INTO regular_school_subjects (student_id, name, icon, color, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(student_id, name, icon || '📚', color || 'indigo', profile.id);

    const subject = db.prepare('SELECT * FROM regular_school_subjects WHERE id = ?').get(result.lastInsertRowid);
    res.json(subject);
  } catch (error: any) {
    console.error('[RegularSchool] Create subject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a subject
router.put('/subjects/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (profile.type !== 'parent') {
      return res.status(403).json({ error: 'Only parents can update subjects' });
    }

    const subjectId = Number(req.params.id);
    const subject = db.prepare('SELECT * FROM regular_school_subjects WHERE id = ?').get(subjectId) as any;

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (!isGuardianOf(profile.id, subject.student_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, icon, color } = req.body;
    db.prepare(`
      UPDATE regular_school_subjects
      SET name = COALESCE(?, name), icon = COALESCE(?, icon), color = COALESCE(?, color)
      WHERE id = ?
    `).run(name, icon, color, subjectId);

    const updated = db.prepare('SELECT * FROM regular_school_subjects WHERE id = ?').get(subjectId);
    res.json(updated);
  } catch (error: any) {
    console.error('[RegularSchool] Update subject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a subject
router.delete('/subjects/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (profile.type !== 'parent') {
      return res.status(403).json({ error: 'Only parents can delete subjects' });
    }

    const subjectId = Number(req.params.id);
    const subject = db.prepare('SELECT * FROM regular_school_subjects WHERE id = ?').get(subjectId) as any;

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (!isGuardianOf(profile.id, subject.student_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    db.prepare('DELETE FROM regular_school_subjects WHERE id = ?').run(subjectId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[RegularSchool] Delete subject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== HOMEWORK ====================

// Get homework for a student
router.get('/homework', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;
    const subjectId = req.query.subject_id ? Number(req.query.subject_id) : null;
    const status = req.query.status as string | null;

    let targetStudentId: number;

    if (profile.type === 'parent') {
      if (!studentId) {
        return res.status(400).json({ error: 'student_id required for parents' });
      }
      if (!isGuardianOf(profile.id, studentId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      targetStudentId = studentId;
    } else if (profile.type === 'child') {
      targetStudentId = profile.id;
    } else {
      return res.status(403).json({ error: 'Only parents and children can access homework' });
    }

    let query = `
      SELECT h.*, s.name as subject_name, s.icon as subject_icon, s.color as subject_color
      FROM regular_school_homework h
      JOIN regular_school_subjects s ON s.id = h.subject_id
      WHERE h.student_id = ?
    `;
    const params: any[] = [targetStudentId];

    if (subjectId) {
      query += ' AND h.subject_id = ?';
      params.push(subjectId);
    }

    if (status) {
      query += ' AND h.status = ?';
      params.push(status);
    }

    query += ' ORDER BY h.due_date IS NULL, h.due_date, h.created_at DESC';

    const homework = db.prepare(query).all(...params);
    res.json(homework);
  } catch (error: any) {
    console.error('[RegularSchool] Get homework error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create homework
router.post('/homework', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (profile.type !== 'parent') {
      return res.status(403).json({ error: 'Only parents can create homework' });
    }

    const { subject_id, student_id, title, description, due_date, points } = req.body;
    if (!subject_id || !student_id || !title) {
      return res.status(400).json({ error: 'subject_id, student_id, and title are required' });
    }

    if (!isGuardianOf(profile.id, Number(student_id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify subject belongs to student
    const subject = db.prepare('SELECT * FROM regular_school_subjects WHERE id = ? AND student_id = ?').get(subject_id, student_id);
    if (!subject) {
      return res.status(400).json({ error: 'Subject not found for this student' });
    }

    const result = db.prepare(`
      INSERT INTO regular_school_homework (subject_id, student_id, title, description, due_date, points, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(subject_id, student_id, title, description || null, due_date || null, points || 10, profile.id);

    const homework = db.prepare(`
      SELECT h.*, s.name as subject_name, s.icon as subject_icon, s.color as subject_color
      FROM regular_school_homework h
      JOIN regular_school_subjects s ON s.id = h.subject_id
      WHERE h.id = ?
    `).get(result.lastInsertRowid);

    res.json(homework);
  } catch (error: any) {
    console.error('[RegularSchool] Create homework error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update homework
router.put('/homework/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (profile.type !== 'parent') {
      return res.status(403).json({ error: 'Only parents can update homework' });
    }

    const homeworkId = Number(req.params.id);
    const homework = db.prepare('SELECT * FROM regular_school_homework WHERE id = ?').get(homeworkId) as any;

    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    if (!isGuardianOf(profile.id, homework.student_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { title, description, due_date, points } = req.body;
    db.prepare(`
      UPDATE regular_school_homework
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          due_date = COALESCE(?, due_date),
          points = COALESCE(?, points)
      WHERE id = ?
    `).run(title, description, due_date, points, homeworkId);

    const updated = db.prepare(`
      SELECT h.*, s.name as subject_name, s.icon as subject_icon, s.color as subject_color
      FROM regular_school_homework h
      JOIN regular_school_subjects s ON s.id = h.subject_id
      WHERE h.id = ?
    `).get(homeworkId);

    res.json(updated);
  } catch (error: any) {
    console.error('[RegularSchool] Update homework error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete homework
router.delete('/homework/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (profile.type !== 'parent') {
      return res.status(403).json({ error: 'Only parents can delete homework' });
    }

    const homeworkId = Number(req.params.id);
    const homework = db.prepare('SELECT * FROM regular_school_homework WHERE id = ?').get(homeworkId) as any;

    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    if (!isGuardianOf(profile.id, homework.student_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    db.prepare('DELETE FROM regular_school_homework WHERE id = ?').run(homeworkId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[RegularSchool] Delete homework error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete homework (can be done by child or parent)
router.post('/homework/:id/complete', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const homeworkId = Number(req.params.id);
    const homework = db.prepare('SELECT * FROM regular_school_homework WHERE id = ?').get(homeworkId) as any;

    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    // Check access
    if (profile.type === 'child') {
      if (homework.student_id !== profile.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (profile.type === 'parent') {
      if (!isGuardianOf(profile.id, homework.student_id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else {
      return res.status(403).json({ error: 'Only parents and children can complete homework' });
    }

    if (homework.status === 'completed') {
      return res.status(400).json({ error: 'Homework already completed' });
    }

    // Mark as completed
    db.prepare(`
      UPDATE regular_school_homework
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(homeworkId);

    // Award points to the student
    const pointsToAward = homework.points || 10;
    db.prepare(`
      UPDATE profiles SET points = points + ? WHERE id = ?
    `).run(pointsToAward, homework.student_id);

    const updated = db.prepare(`
      SELECT h.*, s.name as subject_name, s.icon as subject_icon, s.color as subject_color
      FROM regular_school_homework h
      JOIN regular_school_subjects s ON s.id = h.subject_id
      WHERE h.id = ?
    `).get(homeworkId);

    res.json({ homework: updated, points_awarded: pointsToAward });
  } catch (error: any) {
    console.error('[RegularSchool] Complete homework error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get homework stats for a student
router.get('/stats', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;

    let targetStudentId: number;

    if (profile.type === 'parent') {
      if (!studentId) {
        return res.status(400).json({ error: 'student_id required for parents' });
      }
      if (!isGuardianOf(profile.id, studentId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      targetStudentId = studentId;
    } else if (profile.type === 'child') {
      targetStudentId = profile.id;
    } else {
      return res.status(403).json({ error: 'Only parents and children can access stats' });
    }

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'pending' AND due_date < date('now') THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status = 'pending' AND due_date = date('now') THEN 1 ELSE 0 END) as due_today,
        SUM(CASE WHEN status = 'completed' THEN points ELSE 0 END) as points_earned
      FROM regular_school_homework
      WHERE student_id = ?
    `).get(targetStudentId) as {
      total: number;
      completed: number;
      pending: number;
      overdue: number;
      due_today: number;
      points_earned: number;
    };

    const subjectCount = db.prepare(`
      SELECT COUNT(*) as count FROM regular_school_subjects WHERE student_id = ?
    `).get(targetStudentId) as { count: number };

    res.json({ ...stats, subject_count: subjectCount.count });
  } catch (error: any) {
    console.error('[RegularSchool] Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
