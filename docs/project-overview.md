# Project Overview

## Executive Summary
The Family Learning Hub is a full-stack PWA for family gamification, focusing on children's tasks, goals, diet tracking, and Tigrinya church school integration. It's a brownfield monorepo with React frontend (Vite/Tailwind) and Express backend (TypeScript/SQLite). Aims to motivate kids via points, rewards, AI insights, quizzes. Supports roles: admin/parent/child/teacher. PWA for offline use; push notifications for reminders.

**Goals**:
- Engage children in learning/chores (tasks, school assignments).
- Track nutrition (diet logs vs goals).
- Family collaboration (parent approvals, leaderboards).
- AI assistance (chat for tasks/diet).
- School tools (quizzes, submissions, feedback).

**Tech Stack**:
- Frontend: React 18, TypeScript, Vite, Tailwind, Recharts, Lucide icons.
- Backend: Node.js, Express 4, TypeScript, Better-SQLite3, bcryptjs, multer, node-cron, web-push.
- DB: SQLite (WAL mode); JSON for flexible fields (settings, achievements).
- Deployment: Docker Compose; static frontend via nginx.

**Architecture**: Client-server REST API. Auth: JWT + RBAC. State: React Context. No external DB server; file-based for simplicity.

**Current Status**: Functional MVP; gamification core (tasks/rewards), diet/AI/school partial. Security fixes needed (PIN hashing inconsistency).

Generated on 2026-01-09 via document-project workflow.