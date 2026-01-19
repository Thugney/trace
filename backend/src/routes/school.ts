import express, { Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import db from '../database/init';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import { sendPushNotification, sendPushToProfiles } from '../services/notifications';

const router = express.Router();
router.use(authenticate, requireFeature('school'));

const SCHOOL_ATTACHMENTS_DIR = process.env.SCHOOL_ATTACHMENTS_DIR || path.join(__dirname, '../../data/school-attachments');
const ASSIGNMENT_ATTACHMENTS_DIR = path.join(SCHOOL_ATTACHMENTS_DIR, 'assignments');
const SUBMISSION_ATTACHMENTS_DIR = path.join(SCHOOL_ATTACHMENTS_DIR, 'submissions');

[SCHOOL_ATTACHMENTS_DIR, ASSIGNMENT_ATTACHMENTS_DIR, SUBMISSION_ATTACHMENTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const sanitizeFilename = (name: string) => name.replace(/[^a-zA-Z0-9_.-]/g, '_');

const assignmentAttachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ASSIGNMENT_ATTACHMENTS_DIR),
  filename: (req, file, cb) => {
    const assignmentId = req.params.assignmentId || 'unknown';
    const safeName = sanitizeFilename(file.originalname);
    cb(null, `assignment-${assignmentId}-${Date.now()}-${safeName}`);
  }
});

const submissionAttachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SUBMISSION_ATTACHMENTS_DIR),
  filename: (req, file, cb) => {
    const submissionId = req.params.submissionId || 'unknown';
    const safeName = sanitizeFilename(file.originalname);
    cb(null, `submission-${submissionId}-${Date.now()}-${safeName}`);
  }
});

const assignmentUpload = multer({ storage: assignmentAttachmentStorage });
const submissionUpload = multer({ storage: submissionAttachmentStorage });

const getGuardianStudentIds = (guardianId: number) => {
  const linked = db.prepare('SELECT student_id FROM guardian_students WHERE guardian_id = ?').all(guardianId) as { student_id: number }[];
  if (linked.length > 0) {
    return linked.map(row => row.student_id);
  }
  const fallback = db.prepare('SELECT id FROM profiles WHERE parent_id = ?').all(guardianId) as { id: number }[];
  return fallback.map(row => row.id);
};

const isGuardianOf = (guardianId: number, studentId: number) => {
  const linked = db.prepare('SELECT 1 FROM guardian_students WHERE guardian_id = ? AND student_id = ?').get(guardianId, studentId);
  if (linked) return true;
  const legacy = db.prepare('SELECT 1 FROM profiles WHERE id = ? AND parent_id = ?').get(studentId, guardianId);
  return Boolean(legacy);
};

const teacherHasClass = (teacherId: number, classId: number) => {
  const assigned = db.prepare('SELECT 1 FROM teacher_class_assignments WHERE teacher_id = ? AND class_id = ?').get(teacherId, classId);
  if (assigned) return true;
  const legacy: any = db.prepare('SELECT assigned_class_id FROM profiles WHERE id = ?').get(teacherId);
  return legacy?.assigned_class_id === classId;
};

// Get all enrolled students in a class
const getEnrolledStudents = (classId: number): number[] => {
  const enrolled = db.prepare('SELECT student_id FROM school_enrollments WHERE class_id = ?').all(classId) as { student_id: number }[];
  return enrolled.map(row => row.student_id);
};

// Get guardians (parents) for a student
const getGuardiansForStudent = (studentId: number): number[] => {
  const guardians = db.prepare('SELECT guardian_id FROM guardian_students WHERE student_id = ?').all(studentId) as { guardian_id: number }[];
  if (guardians.length > 0) {
    return guardians.map(row => row.guardian_id);
  }
  // Fallback to legacy parent_id
  const student: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(studentId);
  return student?.parent_id ? [student.parent_id] : [];
};

// ==================== CLASSES ====================
router.get('/classes', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const studentIdParam = req.query.student_id ? Number(req.query.student_id) : null;

    if (studentIdParam) {
      if (profile.type === 'parent' && !isGuardianOf(profile.id, studentIdParam)) {
        return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
      }

      if (profile.type === 'child' && profile.id !== studentIdParam) {
        return res.status(403).json({ error: 'Access denied: wrong student' });
      }

      const classes = db.prepare(`
        SELECT sc.*
        FROM school_classes sc
        JOIN school_enrollments se ON se.class_id = sc.id
        WHERE se.student_id = ?
        ORDER BY sc.name
      `).all(studentIdParam);
      return res.json(classes);
    }

    if (profile.type === 'parent' && req.query.scope === 'all') {
      const classes = db.prepare('SELECT * FROM school_classes ORDER BY name').all();
      return res.json(classes);
    }

    if (profile.type === 'admin') {
      const classes = db.prepare('SELECT * FROM school_classes ORDER BY name').all();
      return res.json(classes);
    }

    if (profile.type === 'teacher') {
      const classes = db.prepare(`
        SELECT sc.*
        FROM school_classes sc
        JOIN teacher_class_assignments tca ON tca.class_id = sc.id
        WHERE tca.teacher_id = ?
        ORDER BY sc.name
      `).all(profile.id);

      if (classes.length > 0) {
        return res.json(classes);
      }

      const legacyClass = db.prepare(`
        SELECT sc.*
        FROM school_classes sc
        JOIN profiles p ON p.assigned_class_id = sc.id
        WHERE p.id = ?
      `).all(profile.id);
      return res.json(legacyClass);
    }

    const studentIds = profile.type === 'child' ? [profile.id] : getGuardianStudentIds(profile.id);
    if (studentIds.length === 0) {
      return res.json([]);
    }

    const placeholders = studentIds.map(() => '?').join(',');
    const classes = db.prepare(`
      SELECT DISTINCT sc.*
      FROM school_classes sc
      JOIN school_enrollments se ON se.class_id = sc.id
      WHERE se.student_id IN (${placeholders})
      ORDER BY sc.name
    `).all(...studentIds);
    return res.json(classes);
  } catch (error: any) {
    console.error('[School] Fetch classes error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/classes', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can create classes' });
    }

    const { name, description, age_min, age_max } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = db.prepare(`
      INSERT INTO school_classes (name, description, age_min, age_max)
      VALUES (?, ?, ?, ?)
    `).run(name, description || null, age_min || null, age_max || null);

    if (profile.type === 'teacher') {
      db.prepare(`
        INSERT OR IGNORE INTO teacher_class_assignments (teacher_id, class_id)
        VALUES (?, ?)
      `).run(profile.id, result.lastInsertRowid);
    }

    const schoolClass = db.prepare('SELECT * FROM school_classes WHERE id = ?').get(result.lastInsertRowid);
    res.json(schoolClass);
  } catch (error: any) {
    console.error('[School] Create class error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/classes/:classId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const classId = Number(req.params.classId);
    const { name, description, age_min, age_max } = req.body;

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, classId)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can update classes' });
    }

    db.prepare(`
      UPDATE school_classes
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          age_min = COALESCE(?, age_min),
          age_max = COALESCE(?, age_max),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, description, age_min, age_max, classId);

    const schoolClass = db.prepare('SELECT * FROM school_classes WHERE id = ?').get(classId);
    res.json(schoolClass);
  } catch (error: any) {
    console.error('[School] Update class error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/classes/:classId/students', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const classId = Number(req.params.classId);
    const profile = req.profile!;

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, classId)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can view rosters' });
    }

    const students = db.prepare(`
      SELECT p.id, p.name, p.age, p.gender, p.avatar
      FROM school_enrollments se
      JOIN profiles p ON p.id = se.student_id
      WHERE se.class_id = ?
      ORDER BY p.name
    `).all(classId);

    res.json(students);
  } catch (error: any) {
    console.error('[School] Class roster error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/classes/:classId/teachers', authenticate, (req: AuthRequest, res: Response) => {
  try {
    if (req.profile?.type !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view class teachers' });
    }

    const classId = Number(req.params.classId);
    const teachers = db.prepare(`
      SELECT p.id, p.name, p.avatar
      FROM teacher_class_assignments tca
      JOIN profiles p ON p.id = tca.teacher_id
      WHERE tca.class_id = ?
      ORDER BY p.name
    `).all(classId);

    res.json(teachers);
  } catch (error: any) {
    console.error('[School] Class teachers error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/classes/:classId/teachers', authenticate, (req: AuthRequest, res: Response) => {
  try {
    if (req.profile?.type !== 'admin') {
      return res.status(403).json({ error: 'Only admins can assign teachers' });
    }

    const classId = Number(req.params.classId);
    const { teacher_id } = req.body;
    if (!teacher_id) {
      return res.status(400).json({ error: 'teacher_id is required' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO teacher_class_assignments (teacher_id, class_id)
      VALUES (?, ?)
    `).run(teacher_id, classId);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[School] Assign teacher error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/classes/:classId/teachers/:teacherId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    if (req.profile?.type !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove teachers' });
    }

    const classId = Number(req.params.classId);
    const teacherId = Number(req.params.teacherId);
    db.prepare('DELETE FROM teacher_class_assignments WHERE teacher_id = ? AND class_id = ?').run(teacherId, classId);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[School] Remove teacher error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SUBJECTS ====================

// Get subjects for a class
router.get('/classes/:classId/subjects', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const classId = Number(req.params.classId);

    // Teachers can only see their assigned classes
    if (profile.type === 'teacher' && !teacherHasClass(profile.id, classId)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    const subjects = db.prepare(`
      SELECT ss.*,
        (SELECT COUNT(*) FROM school_assignments WHERE subject_id = ss.id) as assignment_count
      FROM school_subjects ss
      WHERE ss.class_id = ? AND ss.is_active = 1
      ORDER BY ss.sort_order, ss.name
    `).all(classId);

    res.json(subjects);
  } catch (error: any) {
    console.error('[School] Get subjects error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create subject for a class
router.post('/classes/:classId/subjects', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can create subjects' });
    }

    const classId = Number(req.params.classId);
    const { name, icon, color, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Subject name is required' });
    }

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, classId)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    // Get next sort order
    const maxOrder: any = db.prepare('SELECT MAX(sort_order) as max FROM school_subjects WHERE class_id = ?').get(classId);
    const sortOrder = (maxOrder?.max || 0) + 1;

    const result = db.prepare(`
      INSERT INTO school_subjects (class_id, name, icon, color, description, sort_order, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(classId, name, icon || '📚', color || 'indigo', description || null, sortOrder, profile.id);

    const subject = db.prepare('SELECT * FROM school_subjects WHERE id = ?').get(result.lastInsertRowid);
    res.json(subject);
  } catch (error: any) {
    console.error('[School] Create subject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update subject
router.put('/subjects/:subjectId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can update subjects' });
    }

    const subjectId = Number(req.params.subjectId);
    const subject: any = db.prepare('SELECT * FROM school_subjects WHERE id = ?').get(subjectId);

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, subject.class_id)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    const { name, icon, color, description, sort_order } = req.body;

    db.prepare(`
      UPDATE school_subjects
      SET name = COALESCE(?, name),
          icon = COALESCE(?, icon),
          color = COALESCE(?, color),
          description = COALESCE(?, description),
          sort_order = COALESCE(?, sort_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, icon, color, description, sort_order, subjectId);

    const updated = db.prepare('SELECT * FROM school_subjects WHERE id = ?').get(subjectId);
    res.json(updated);
  } catch (error: any) {
    console.error('[School] Update subject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete subject (soft delete)
router.delete('/subjects/:subjectId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can delete subjects' });
    }

    const subjectId = Number(req.params.subjectId);
    const subject: any = db.prepare('SELECT * FROM school_subjects WHERE id = ?').get(subjectId);

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, subject.class_id)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    // Soft delete - mark inactive, keep assignments
    db.prepare('UPDATE school_subjects SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(subjectId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[School] Delete subject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Seed default subjects for a class (Language & Religion)
router.post('/classes/:classId/seed-subjects', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can seed subjects' });
    }

    const classId = Number(req.params.classId);

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, classId)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    const defaultSubjects = [
      { name: 'Language', icon: '🗣️', color: 'blue', sort_order: 1 },
      { name: 'Religion', icon: '⛪', color: 'purple', sort_order: 2 }
    ];

    const insertSubject = db.prepare(`
      INSERT OR IGNORE INTO school_subjects (class_id, name, icon, color, sort_order, created_by)
      SELECT ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM school_subjects WHERE class_id = ? AND name = ? AND is_active = 1
      )
    `);

    for (const subj of defaultSubjects) {
      insertSubject.run(classId, subj.name, subj.icon, subj.color, subj.sort_order, profile.id, classId, subj.name);
    }

    const subjects = db.prepare(`
      SELECT * FROM school_subjects WHERE class_id = ? AND is_active = 1 ORDER BY sort_order
    `).all(classId);

    res.json(subjects);
  } catch (error: any) {
    console.error('[School] Seed subjects error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENROLLMENTS ====================
router.post('/enrollments', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'parent'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or parents can enroll students' });
    }

    const { student_id, class_id } = req.body;
    if (!student_id || !class_id) {
      return res.status(400).json({ error: 'student_id and class_id are required' });
    }

    if (profile.type === 'parent' && !isGuardianOf(profile.id, Number(student_id))) {
      return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO school_enrollments (student_id, class_id)
      VALUES (?, ?)
    `).run(student_id, class_id);

    db.prepare(`
      INSERT OR IGNORE INTO school_student_progress (student_id, class_id)
      VALUES (?, ?)
    `).run(student_id, class_id);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[School] Enroll student error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/enrollments', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'parent'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or parents can unenroll students' });
    }

    const { student_id, class_id } = req.body;
    if (!student_id || !class_id) {
      return res.status(400).json({ error: 'student_id and class_id are required' });
    }

    if (profile.type === 'parent' && !isGuardianOf(profile.id, Number(student_id))) {
      return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
    }

    db.prepare('DELETE FROM school_enrollments WHERE student_id = ? AND class_id = ?').run(student_id, class_id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[School] Unenroll student error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ASSIGNMENTS ====================
router.get('/assignments', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const classId = req.query.class_id ? Number(req.query.class_id) : null;
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;

    if (profile.type === 'admin') {
      if (studentId) {
        const assignments = db.prepare(`
          SELECT sa.*, sc.name as class_name, p.name as teacher_name,
            ss.status as submission_status, ss.submitted_at,
            subj.name as subject_name, subj.icon as subject_icon, subj.color as subject_color
          FROM school_assignments sa
          JOIN school_classes sc ON sc.id = sa.class_id
          JOIN profiles p ON p.id = sa.teacher_id
          JOIN school_enrollments se ON se.class_id = sa.class_id
          LEFT JOIN school_submissions ss ON ss.assignment_id = sa.id AND ss.student_id = ?
          LEFT JOIN school_subjects subj ON subj.id = sa.subject_id
          WHERE se.student_id = ?
          ORDER BY sa.due_date IS NULL, sa.due_date, sa.created_at DESC
        `).all(studentId, studentId);
        return res.json(assignments);
      }

      if (classId) {
        const assignments = db.prepare(`
          SELECT sa.*, sc.name as class_name, p.name as teacher_name,
            subj.name as subject_name, subj.icon as subject_icon, subj.color as subject_color
          FROM school_assignments sa
          JOIN school_classes sc ON sc.id = sa.class_id
          JOIN profiles p ON p.id = sa.teacher_id
          LEFT JOIN school_subjects subj ON subj.id = sa.subject_id
          WHERE sa.class_id = ?
          ORDER BY sa.due_date IS NULL, sa.due_date, sa.created_at DESC
        `).all(classId);
        return res.json(assignments);
      }

      const assignments = db.prepare(`
        SELECT sa.*, sc.name as class_name, p.name as teacher_name,
          subj.name as subject_name, subj.icon as subject_icon, subj.color as subject_color
        FROM school_assignments sa
        JOIN school_classes sc ON sc.id = sa.class_id
        JOIN profiles p ON p.id = sa.teacher_id
        LEFT JOIN school_subjects subj ON subj.id = sa.subject_id
        ORDER BY sa.due_date IS NULL, sa.due_date, sa.created_at DESC
      `).all();
      return res.json(assignments);
    }

    if (profile.type === 'teacher') {
      if (classId && !teacherHasClass(profile.id, classId)) {
        return res.status(403).json({ error: 'Access denied: class not assigned' });
      }

      const assignments = db.prepare(`
        SELECT sa.*, sc.name as class_name,
          subj.name as subject_name, subj.icon as subject_icon, subj.color as subject_color
        FROM school_assignments sa
        JOIN school_classes sc ON sc.id = sa.class_id
        LEFT JOIN school_subjects subj ON subj.id = sa.subject_id
        WHERE sa.class_id IN (
          SELECT class_id FROM teacher_class_assignments WHERE teacher_id = ?
          UNION
          SELECT assigned_class_id FROM profiles WHERE id = ? AND assigned_class_id IS NOT NULL
        )
        ${classId ? 'AND sa.class_id = ?' : ''}
        ORDER BY sa.due_date IS NULL, sa.due_date, sa.created_at DESC
      `).all(...(classId ? [profile.id, profile.id, classId] : [profile.id, profile.id]));
      return res.json(assignments);
    }

    const resolvedStudentIds = profile.type === 'child'
      ? [profile.id]
      : (studentId ? [studentId] : getGuardianStudentIds(profile.id));

    if (profile.type === 'parent' && studentId && !isGuardianOf(profile.id, studentId)) {
      return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
    }

    if (resolvedStudentIds.length === 0) {
      return res.json([]);
    }

    if (resolvedStudentIds.length === 1) {
      const targetStudent = resolvedStudentIds[0];
      const assignments = db.prepare(`
        SELECT sa.*, sc.name as class_name, p.name as teacher_name,
          ss.status as submission_status, ss.submitted_at,
          subj.name as subject_name, subj.icon as subject_icon, subj.color as subject_color
        FROM school_assignments sa
        JOIN school_classes sc ON sc.id = sa.class_id
        JOIN profiles p ON p.id = sa.teacher_id
        JOIN school_enrollments se ON se.class_id = sa.class_id
        LEFT JOIN school_submissions ss ON ss.assignment_id = sa.id AND ss.student_id = ?
        LEFT JOIN school_subjects subj ON subj.id = sa.subject_id
        WHERE se.student_id = ?
        ORDER BY sa.due_date IS NULL, sa.due_date, sa.created_at DESC
      `).all(targetStudent, targetStudent);
      return res.json(assignments);
    }

    const placeholders = resolvedStudentIds.map(() => '?').join(',');
    const assignments = db.prepare(`
      SELECT DISTINCT sa.*, sc.name as class_name, p.name as teacher_name,
        subj.name as subject_name, subj.icon as subject_icon, subj.color as subject_color
      FROM school_assignments sa
      JOIN school_classes sc ON sc.id = sa.class_id
      JOIN profiles p ON p.id = sa.teacher_id
      JOIN school_enrollments se ON se.class_id = sa.class_id
      LEFT JOIN school_subjects subj ON subj.id = sa.subject_id
      WHERE se.student_id IN (${placeholders})
      ORDER BY sa.due_date IS NULL, sa.due_date, sa.created_at DESC
    `).all(...resolvedStudentIds);
    return res.json(assignments);
  } catch (error: any) {
    console.error('[School] Fetch assignments error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/assignments', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can create assignments' });
    }

    const { class_id, title, description, type, youtube_link, attachment_url, due_date, linked_quiz_id, subject_id } = req.body;
    if (!class_id || !title) {
      return res.status(400).json({ error: 'class_id and title are required' });
    }

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, Number(class_id))) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    const result = db.prepare(`
      INSERT INTO school_assignments (
        class_id, teacher_id, title, description, type, youtube_link, attachment_url, due_date, linked_quiz_id, subject_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      class_id,
      profile.id,
      title,
      description || null,
      type || 'homework',
      youtube_link || null,
      attachment_url || null,
      due_date || null,
      linked_quiz_id || null,
      subject_id || null
    );

    const assignment = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(result.lastInsertRowid);

    // Send notifications to enrolled students and their parents
    const schoolClass: any = db.prepare('SELECT name FROM school_classes WHERE id = ?').get(class_id);
    const className = schoolClass?.name || 'class';
    const enrolledStudents = getEnrolledStudents(Number(class_id));

    // Collect all profile IDs to notify (students + their guardians)
    const profilesToNotify: number[] = [...enrolledStudents];
    for (const studentId of enrolledStudents) {
      const guardians = getGuardiansForStudent(studentId);
      profilesToNotify.push(...guardians);
    }

    // Remove duplicates
    const uniqueProfiles = [...new Set(profilesToNotify)];

    if (uniqueProfiles.length > 0) {
      sendPushToProfiles(uniqueProfiles, {
        type: 'school_assignment',
        title: 'New Assignment',
        message: `New assignment in ${className}: "${title}"`,
        url: '/school',
        data: { assignmentId: result.lastInsertRowid, classId: class_id }
      }).catch(err => console.error('[School] Notification error:', err));
    }

    res.json(assignment);
  } catch (error: any) {
    console.error('[School] Create assignment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/assignments/:assignmentId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const assignmentId = Number(req.params.assignmentId);
    const assignment: any = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(assignmentId);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (profile.type === 'teacher') {
      if (!teacherHasClass(profile.id, assignment.class_id)) {
        return res.status(403).json({ error: 'Access denied: class not assigned' });
      }
      if (assignment.teacher_id !== profile.id) {
        return res.status(403).json({ error: 'Access denied: only the creator can update this assignment' });
      }
    }

    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can update assignments' });
    }

    const { title, description, type, youtube_link, attachment_url, due_date, linked_quiz_id } = req.body;

    db.prepare(`
      UPDATE school_assignments
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          type = COALESCE(?, type),
          youtube_link = COALESCE(?, youtube_link),
          attachment_url = COALESCE(?, attachment_url),
          due_date = COALESCE(?, due_date),
          linked_quiz_id = COALESCE(?, linked_quiz_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, type, youtube_link, attachment_url, due_date, linked_quiz_id, assignmentId);

    const updated = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(assignmentId);
    res.json(updated);
  } catch (error: any) {
    console.error('[School] Update assignment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/assignments/:assignmentId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const assignmentId = Number(req.params.assignmentId);
    const assignment: any = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(assignmentId);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (profile.type === 'teacher') {
      if (!teacherHasClass(profile.id, assignment.class_id)) {
        return res.status(403).json({ error: 'Access denied: class not assigned' });
      }
      if (assignment.teacher_id !== profile.id) {
        return res.status(403).json({ error: 'Access denied: only the creator can delete this assignment' });
      }
    }

    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can delete assignments' });
    }

    db.prepare('DELETE FROM school_assignments WHERE id = ?').run(assignmentId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[School] Delete assignment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/assignments/:assignmentId/attachments', authenticate, assignmentUpload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const assignmentId = Number(req.params.assignmentId);
    const assignment: any = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(assignmentId);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can upload assignment files' });
    }

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, assignment.class_id)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const fileUrl = `/api/school/attachments/assignments/${req.file.filename}`;

    const result = db.prepare(`
      INSERT INTO school_assignment_attachments (assignment_id, uploaded_by, file_url, file_name, file_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(assignmentId, profile.id, fileUrl, req.file.originalname, req.file.mimetype);

    const attachment = db.prepare('SELECT * FROM school_assignment_attachments WHERE id = ?').get(result.lastInsertRowid);
    res.json(attachment);
  } catch (error: any) {
    console.error('[School] Upload assignment attachment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/assignments/:assignmentId/attachments', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const assignment: any = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const profile = req.profile!;
    if (profile.type === 'teacher' && !teacherHasClass(profile.id, assignment.class_id)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    if (profile.type === 'parent' || profile.type === 'child') {
      const studentId = profile.type === 'child' ? profile.id : Number(req.query.student_id);
      if (!studentId) {
        return res.status(400).json({ error: 'student_id is required for parent access' });
      }
      if (profile.type === 'parent' && !isGuardianOf(profile.id, studentId)) {
        return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
      }
      const enrolled = db.prepare('SELECT 1 FROM school_enrollments WHERE class_id = ? AND student_id = ?').get(assignment.class_id, studentId);
      if (!enrolled) {
        return res.status(403).json({ error: 'Access denied: student not enrolled' });
      }
    }

    const attachments = db.prepare('SELECT * FROM school_assignment_attachments WHERE assignment_id = ? ORDER BY created_at DESC').all(assignmentId);
    res.json(attachments);
  } catch (error: any) {
    console.error('[School] Fetch assignment attachments error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/attachments/assignments/:filename', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const filename = req.params.filename;
    const attachment: any = db.prepare('SELECT * FROM school_assignment_attachments WHERE file_url = ?').get(`/api/school/attachments/assignments/${filename}`);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const assignment: any = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(attachment.assignment_id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const profile = req.profile!;
    if (profile.type === 'teacher' && !teacherHasClass(profile.id, assignment.class_id)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    if (profile.type === 'parent' || profile.type === 'child') {
      const studentId = profile.type === 'child' ? profile.id : Number(req.query.student_id);
      if (!studentId) {
        return res.status(400).json({ error: 'student_id is required for parent access' });
      }
      if (profile.type === 'parent' && !isGuardianOf(profile.id, studentId)) {
        return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
      }
      const enrolled = db.prepare('SELECT 1 FROM school_enrollments WHERE class_id = ? AND student_id = ?').get(assignment.class_id, studentId);
      if (!enrolled) {
        return res.status(403).json({ error: 'Access denied: student not enrolled' });
      }
    }

    const filePath = path.join(ASSIGNMENT_ATTACHMENTS_DIR, filename);
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('[School] Serve assignment attachment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SUBMISSIONS ====================
router.get('/submissions', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const assignmentId = req.query.assignment_id ? Number(req.query.assignment_id) : null;
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;

    if (profile.type === 'admin') {
      const submissions = db.prepare(`
        SELECT ss.*, p.name as student_name
        FROM school_submissions ss
        JOIN profiles p ON p.id = ss.student_id
        ${assignmentId ? 'WHERE ss.assignment_id = ?' : ''}
        ORDER BY ss.submitted_at DESC
      `).all(...(assignmentId ? [assignmentId] : []));
      return res.json(submissions);
    }

    if (profile.type === 'teacher') {
      let classFilter = '';
      const params: any[] = [profile.id, profile.id];
      if (assignmentId) {
        classFilter = 'AND ss.assignment_id = ?';
        params.push(assignmentId);
      }
      const submissions = db.prepare(`
        SELECT ss.*, p.name as student_name, sa.class_id
        FROM school_submissions ss
        JOIN profiles p ON p.id = ss.student_id
        JOIN school_assignments sa ON sa.id = ss.assignment_id
        WHERE sa.class_id IN (
          SELECT class_id FROM teacher_class_assignments WHERE teacher_id = ?
          UNION
          SELECT assigned_class_id FROM profiles WHERE id = ? AND assigned_class_id IS NOT NULL
        )
        ${classFilter}
        ORDER BY ss.submitted_at DESC
      `).all(...params);
      return res.json(submissions);
    }

    const targetStudentId = profile.type === 'child' ? profile.id : studentId;
    if (!targetStudentId) {
      return res.status(400).json({ error: 'student_id is required for parent access' });
    }

    if (profile.type === 'parent' && !isGuardianOf(profile.id, targetStudentId)) {
      return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
    }

    const submissions = db.prepare(`
      SELECT ss.*, sa.title as assignment_title
      FROM school_submissions ss
      JOIN school_assignments sa ON sa.id = ss.assignment_id
      WHERE ss.student_id = ?
      ${assignmentId ? 'AND ss.assignment_id = ?' : ''}
      ORDER BY ss.submitted_at DESC
    `).all(...(assignmentId ? [targetStudentId, assignmentId] : [targetStudentId]));
    return res.json(submissions);
  } catch (error: any) {
    console.error('[School] Fetch submissions error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/submissions', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const { assignment_id, student_id, notes } = req.body;
    if (!assignment_id) {
      return res.status(400).json({ error: 'assignment_id is required' });
    }

    const assignment: any = db.prepare('SELECT * FROM school_assignments WHERE id = ?').get(assignment_id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    let targetStudentId = profile.type === 'child' ? profile.id : Number(student_id);
    if (profile.type === 'parent') {
      if (!targetStudentId) {
        return res.status(400).json({ error: 'student_id is required for parent submissions' });
      }
      if (!isGuardianOf(profile.id, targetStudentId)) {
        return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
      }
    }

    if (profile.type === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot submit assignments' });
    }

    if (!targetStudentId) {
      return res.status(400).json({ error: 'student_id is required' });
    }

    const enrolled = db.prepare('SELECT 1 FROM school_enrollments WHERE class_id = ? AND student_id = ?').get(assignment.class_id, targetStudentId);
    if (!enrolled) {
      return res.status(403).json({ error: 'Student not enrolled in this class' });
    }

    db.prepare(`
      INSERT OR REPLACE INTO school_submissions (assignment_id, student_id, notes, submitted_at, status)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'submitted')
    `).run(assignment_id, targetStudentId, notes || null);

    const submission = db.prepare('SELECT * FROM school_submissions WHERE assignment_id = ? AND student_id = ?').get(assignment_id, targetStudentId);

    // Notify teachers about the new submission
    try {
      const studentInfo: any = db.prepare('SELECT name FROM profiles WHERE id = ?').get(targetStudentId);
      const classInfo: any = db.prepare('SELECT name FROM school_classes WHERE id = ?').get(assignment.class_id);
      const studentName = studentInfo?.name || 'A student';
      const className = classInfo?.name || 'class';

      // Get all teachers assigned to this class
      const assignedTeachers = db.prepare(`
        SELECT teacher_id FROM teacher_class_assignments WHERE class_id = ?
      `).all(assignment.class_id) as { teacher_id: number }[];

      // Also check legacy assigned_class_id
      const legacyTeachers = db.prepare(`
        SELECT id as teacher_id FROM profiles WHERE assigned_class_id = ? AND type = 'teacher'
      `).all(assignment.class_id) as { teacher_id: number }[];

      const allTeacherIds = [...new Set([
        ...assignedTeachers.map(t => t.teacher_id),
        ...legacyTeachers.map(t => t.teacher_id)
      ])];

      if (allTeacherIds.length > 0) {
        sendPushToProfiles(allTeacherIds, {
          type: 'school_submission',
          title: 'New Submission',
          message: `${studentName} submitted work for "${assignment.title}" in ${className}`,
          url: '/school',
          data: { assignmentId: assignment_id, classId: assignment.class_id, studentId: targetStudentId }
        }).catch(err => console.error('[School] Failed to notify teachers:', err));
      }
    } catch (notifyError) {
      console.error('[School] Error sending submission notification:', notifyError);
    }

    res.json(submission);
  } catch (error: any) {
    console.error('[School] Create submission error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/submissions/:submissionId/status', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can update submission status' });
    }

    const submissionId = Number(req.params.submissionId);
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const submission: any = db.prepare(`
      SELECT ss.*, sa.class_id
      FROM school_submissions ss
      JOIN school_assignments sa ON sa.id = ss.assignment_id
      WHERE ss.id = ?
    `).get(submissionId);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, submission.class_id)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    db.prepare('UPDATE school_submissions SET status = ? WHERE id = ?').run(status, submissionId);
    const updated = db.prepare('SELECT * FROM school_submissions WHERE id = ?').get(submissionId);
    res.json(updated);
  } catch (error: any) {
    console.error('[School] Update submission status error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/submissions/:submissionId/attachments', authenticate, submissionUpload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const submissionId = Number(req.params.submissionId);
    const submission: any = db.prepare(`
      SELECT ss.*, sa.class_id
      FROM school_submissions ss
      JOIN school_assignments sa ON sa.id = ss.assignment_id
      WHERE ss.id = ?
    `).get(submissionId);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (profile.type === 'teacher') {
      return res.status(403).json({ error: 'Teachers cannot upload submission files' });
    }

    const targetStudentId = profile.type === 'child' ? profile.id : Number(req.query.student_id);
    if (profile.type === 'parent') {
      if (!targetStudentId) {
        return res.status(400).json({ error: 'student_id is required for parent uploads' });
      }
      if (!isGuardianOf(profile.id, targetStudentId)) {
        return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
      }
    }

    if (targetStudentId && submission.student_id !== targetStudentId) {
      return res.status(403).json({ error: 'Access denied: wrong student submission' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const fileUrl = `/api/school/attachments/submissions/${req.file.filename}`;
    const result = db.prepare(`
      INSERT INTO school_submission_attachments (submission_id, uploaded_by, file_url, file_name, file_type)
      VALUES (?, ?, ?, ?, ?)
    `).run(submissionId, profile.id, fileUrl, req.file.originalname, req.file.mimetype);

    const attachment = db.prepare('SELECT * FROM school_submission_attachments WHERE id = ?').get(result.lastInsertRowid);
    res.json(attachment);
  } catch (error: any) {
    console.error('[School] Upload submission attachment error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/submissions/:submissionId/attachments', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const submissionId = Number(req.params.submissionId);
    const submission: any = db.prepare(`
      SELECT ss.*, sa.class_id
      FROM school_submissions ss
      JOIN school_assignments sa ON sa.id = ss.assignment_id
      WHERE ss.id = ?
    `).get(submissionId);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const profile = req.profile!;
    if (profile.type === 'teacher' && !teacherHasClass(profile.id, submission.class_id)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    if (profile.type === 'parent' && !isGuardianOf(profile.id, submission.student_id)) {
      return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
    }

    if (profile.type === 'child' && submission.student_id !== profile.id) {
      return res.status(403).json({ error: 'Access denied: wrong submission' });
    }

    const attachments = db.prepare('SELECT * FROM school_submission_attachments WHERE submission_id = ? ORDER BY created_at DESC').all(submissionId);
    res.json(attachments);
  } catch (error: any) {
    console.error('[School] Fetch submission attachments error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/attachments/submissions/:filename', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const filename = req.params.filename;
    const attachment: any = db.prepare('SELECT * FROM school_submission_attachments WHERE file_url = ?').get(`/api/school/attachments/submissions/${filename}`);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const submission: any = db.prepare(`
      SELECT ss.*, sa.class_id
      FROM school_submissions ss
      JOIN school_assignments sa ON sa.id = ss.assignment_id
      WHERE ss.id = ?
    `).get(attachment.submission_id);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const profile = req.profile!;
    if (profile.type === 'teacher' && !teacherHasClass(profile.id, submission.class_id)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    if (profile.type === 'parent' && !isGuardianOf(profile.id, submission.student_id)) {
      return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
    }

    if (profile.type === 'child' && submission.student_id !== profile.id) {
      return res.status(403).json({ error: 'Access denied: wrong submission' });
    }

    const filePath = path.join(SUBMISSION_ATTACHMENTS_DIR, filename);
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('[School] Serve submission attachment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FEEDBACK ====================
router.get('/feedback', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    const submissionId = req.query.submission_id ? Number(req.query.submission_id) : null;
    const studentId = req.query.student_id ? Number(req.query.student_id) : null;

    if (submissionId) {
      const feedback = db.prepare(`
        SELECT sf.*, p.name as teacher_name
        FROM school_feedback sf
        JOIN profiles p ON p.id = sf.teacher_id
        WHERE sf.submission_id = ?
        ORDER BY sf.created_at DESC
      `).all(submissionId);
      return res.json(feedback);
    }

    if (profile.type === 'admin') {
      const feedback = db.prepare(`
        SELECT sf.*, p.name as teacher_name
        FROM school_feedback sf
        JOIN profiles p ON p.id = sf.teacher_id
        ORDER BY sf.created_at DESC
      `).all();
      return res.json(feedback);
    }

    const targetStudentId = profile.type === 'child' ? profile.id : studentId;
    if (profile.type === 'parent') {
      if (!targetStudentId) {
        return res.status(400).json({ error: 'student_id is required for parent access' });
      }
      if (!isGuardianOf(profile.id, targetStudentId)) {
        return res.status(403).json({ error: 'Access denied: child not linked to guardian' });
      }
    }

    if (!targetStudentId) {
      return res.status(400).json({ error: 'student_id is required' });
    }

    const feedback = db.prepare(`
      SELECT sf.*, p.name as teacher_name
      FROM school_feedback sf
      JOIN profiles p ON p.id = sf.teacher_id
      JOIN school_submissions ss ON ss.id = sf.submission_id
      WHERE ss.student_id = ?
      ORDER BY sf.created_at DESC
    `).all(targetStudentId);
    return res.json(feedback);
  } catch (error: any) {
    console.error('[School] Fetch feedback error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/feedback', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (!['admin', 'teacher'].includes(profile.type)) {
      return res.status(403).json({ error: 'Only admins or teachers can leave feedback' });
    }

    const { submission_id, comment, rating, status } = req.body;
    if (!submission_id || !comment) {
      return res.status(400).json({ error: 'submission_id and comment are required' });
    }

    const submission: any = db.prepare(`
      SELECT ss.*, sa.class_id
      FROM school_submissions ss
      JOIN school_assignments sa ON sa.id = ss.assignment_id
      WHERE ss.id = ?
    `).get(submission_id);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (profile.type === 'teacher' && !teacherHasClass(profile.id, submission.class_id)) {
      return res.status(403).json({ error: 'Access denied: class not assigned' });
    }

    const result = db.prepare(`
      INSERT INTO school_feedback (submission_id, teacher_id, comment, rating)
      VALUES (?, ?, ?, ?)
    `).run(submission_id, profile.id, comment, rating || null);

    if (status) {
      db.prepare('UPDATE school_submissions SET status = ? WHERE id = ?').run(status, submission_id);
    }

    const feedback = db.prepare('SELECT * FROM school_feedback WHERE id = ?').get(result.lastInsertRowid);

    // Send notification to student and their guardians
    const assignmentInfo: any = db.prepare(`
      SELECT sa.title FROM school_assignments sa
      WHERE sa.id = ?
    `).get(submission.assignment_id);

    const studentId = submission.student_id;
    const assignmentTitle = assignmentInfo?.title || 'assignment';

    // Determine notification message based on status
    let notificationTitle = 'New Feedback';
    let notificationMessage = `Your teacher left feedback on "${assignmentTitle}"`;
    if (status === 'approved') {
      notificationTitle = 'Work Approved!';
      notificationMessage = `Your work on "${assignmentTitle}" has been approved!`;
    } else if (status === 'needs_revision') {
      notificationTitle = 'Revision Needed';
      notificationMessage = `Your teacher requested changes to "${assignmentTitle}"`;
    }

    // Notify student and their guardians
    const profilesToNotify: number[] = [studentId];
    const guardians = getGuardiansForStudent(studentId);
    profilesToNotify.push(...guardians);

    const uniqueProfiles = [...new Set(profilesToNotify)];

    if (uniqueProfiles.length > 0) {
      sendPushToProfiles(uniqueProfiles, {
        type: 'school_feedback',
        title: notificationTitle,
        message: notificationMessage,
        url: '/school',
        data: { submissionId: submission_id, assignmentId: submission.assignment_id, status }
      }).catch(err => console.error('[School] Feedback notification error:', err));
    }

    res.json(feedback);
  } catch (error: any) {
    console.error('[School] Create feedback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== DUE SOON REMINDERS ====================
// Send reminders for assignments due within the next 24 hours
router.post('/send-due-reminders', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;
    if (profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only admins can trigger due reminders' });
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find assignments due within 24 hours that haven't been submitted
    const dueSoonAssignments: any[] = db.prepare(`
      SELECT sa.id, sa.title, sa.due_date, sa.class_id, sc.name as class_name
      FROM school_assignments sa
      JOIN school_classes sc ON sc.id = sa.class_id
      WHERE sa.due_date IS NOT NULL
        AND sa.due_date > ?
        AND sa.due_date <= ?
    `).all(now.toISOString(), tomorrow.toISOString());

    let notificationsSent = 0;

    for (const assignment of dueSoonAssignments) {
      const enrolledStudents = getEnrolledStudents(assignment.class_id);

      // For each student, check if they've already submitted
      for (const studentId of enrolledStudents) {
        const submission: any = db.prepare(`
          SELECT 1 FROM school_submissions
          WHERE assignment_id = ? AND student_id = ?
        `).get(assignment.id, studentId);

        // Only notify if not yet submitted
        if (!submission) {
          const profilesToNotify: number[] = [studentId];
          const guardians = getGuardiansForStudent(studentId);
          profilesToNotify.push(...guardians);

          const uniqueProfiles = [...new Set(profilesToNotify)];

          const dueDate = new Date(assignment.due_date);
          const hoursLeft = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));

          await sendPushToProfiles(uniqueProfiles, {
            type: 'school_due_soon',
            title: 'Assignment Due Soon',
            message: `"${assignment.title}" in ${assignment.class_name} is due in ${hoursLeft} hours!`,
            url: '/school',
            data: { assignmentId: assignment.id, classId: assignment.class_id }
          });

          notificationsSent += uniqueProfiles.length;
        }
      }
    }

    res.json({
      success: true,
      assignmentsChecked: dueSoonAssignments.length,
      notificationsSent
    });
  } catch (error: any) {
    console.error('[School] Due reminder error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
