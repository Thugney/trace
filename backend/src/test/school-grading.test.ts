import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { testDb } from './setup.js';
import { createTestProfile, authHeaders } from './helpers.js';

function createSchoolTables() {
  try {
    testDb.exec('ALTER TABLE profiles ADD COLUMN assigned_class_id INTEGER');
  } catch {}
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS school_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS teacher_class_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS school_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      max_points INTEGER DEFAULT 10
    );
    CREATE TABLE IF NOT EXISTS school_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('submitted', 'approved', 'needs_revision')) DEFAULT 'submitted',
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      points_earned INTEGER DEFAULT NULL,
      points_possible INTEGER DEFAULT NULL,
      graded_at DATETIME DEFAULT NULL,
      graded_by INTEGER DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS school_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      rating INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seed() {
  const teacher = createTestProfile({ name: 'Teacher', type: 'admin' as any });
  testDb.prepare("UPDATE profiles SET type = 'teacher' WHERE id = ?").run(teacher.id);
  const otherTeacher = createTestProfile({ name: 'Other Teacher', type: 'admin' as any });
  testDb.prepare("UPDATE profiles SET type = 'teacher' WHERE id = ?").run(otherTeacher.id);
  const parent = createTestProfile({ name: 'Parent', type: 'parent' });
  const student = createTestProfile({ name: 'Student', type: 'child', parent_id: parent.id });

  const classId = Number(testDb.prepare("INSERT INTO school_classes (name) VALUES ('Class 1')").run().lastInsertRowid);
  testDb.prepare('INSERT INTO teacher_class_assignments (teacher_id, class_id) VALUES (?, ?)').run(teacher.id, classId);
  const assignmentId = Number(testDb.prepare(`
    INSERT INTO school_assignments (class_id, teacher_id, title, max_points) VALUES (?, ?, 'Psalm 23', 20)
  `).run(classId, teacher.id).lastInsertRowid);
  const submissionId = Number(testDb.prepare(`
    INSERT INTO school_submissions (assignment_id, student_id) VALUES (?, ?)
  `).run(assignmentId, student.id).lastInsertRowid);

  return { teacher, otherTeacher, parent, student, classId, submissionId };
}

async function createApp() {
  const { default: schoolRoutes } = await import('../routes/school.js');
  const app = express();
  app.use(express.json());
  app.use('/school', schoolRoutes);
  return app;
}

describe('school grading contract', () => {
  beforeAll(() => {
    createSchoolTables();
  });

  afterEach(() => {
    for (const table of ['school_feedback', 'school_submissions', 'school_assignments', 'teacher_class_assignments', 'school_classes']) {
      testDb.exec(`DELETE FROM ${table}`);
    }
  });

  it('lists ungraded submissions only for the teacher\'s classes', async () => {
    const app = await createApp();
    const { teacher, otherTeacher, parent, classId } = seed();

    const own = await request(app).get('/school/submissions/ungraded').set(authHeaders(teacher.id));
    expect(own.status).toBe(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].max_points).toBe(20);

    const other = await request(app).get('/school/submissions/ungraded').set(authHeaders(otherTeacher.id));
    expect(other.status).toBe(200);
    expect(other.body).toHaveLength(0);

    const otherClass = await request(app).get('/school/submissions/ungraded').query({ class_id: classId }).set(authHeaders(otherTeacher.id));
    expect(otherClass.status).toBe(403);

    const asParent = await request(app).get('/school/submissions/ungraded').set(authHeaders(parent.id));
    expect(asParent.status).toBe(403);
  });

  it('grades a submission with validated points and records feedback', async () => {
    const app = await createApp();
    const { teacher, submissionId } = seed();

    const tooMany = await request(app)
      .post(`/school/submissions/${submissionId}/grade`)
      .set(authHeaders(teacher.id))
      .send({ points_earned: 25 });
    expect(tooMany.status).toBe(400);

    const graded = await request(app)
      .post(`/school/submissions/${submissionId}/grade`)
      .set(authHeaders(teacher.id))
      .send({ points_earned: 18, feedback: 'Great reading!', status: 'approved' });
    expect(graded.status).toBe(200);
    expect(graded.body.totalPointsAwarded).toBe(18);
    expect(graded.body.studentTotalPoints).toBe(18);

    const row: any = testDb.prepare('SELECT * FROM school_submissions WHERE id = ?').get(submissionId);
    expect(row.points_earned).toBe(18);
    expect(row.points_possible).toBe(20);
    expect(row.graded_by).toBe(teacher.id);
    expect(row.status).toBe('approved');
    expect(testDb.prepare('SELECT COUNT(*) as n FROM school_feedback').get()).toEqual({ n: 1 });

    // Regrading overwrites rather than accumulating
    const regraded = await request(app)
      .post(`/school/submissions/${submissionId}/grade`)
      .set(authHeaders(teacher.id))
      .send({ points_earned: 15 });
    expect(regraded.body.studentTotalPoints).toBe(15);

    // Grading does not write to the FamilyHub points economy
    expect(testDb.prepare('SELECT COUNT(*) as n FROM progress').get()).toEqual({ n: 0 });
  });

  it('denies grading by unassigned teachers, parents and students', async () => {
    const app = await createApp();
    const { otherTeacher, parent, student, submissionId } = seed();

    for (const profile of [otherTeacher, parent, student]) {
      const response = await request(app)
        .post(`/school/submissions/${submissionId}/grade`)
        .set(authHeaders(profile.id))
        .send({ points_earned: 5 });
      expect(response.status).toBe(403);
    }
  });
});
