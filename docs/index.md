# Family Learning Hub Documentation Index

Generated: 2026-01-09 (Deep Scan - Initial Documentation)

Operational docs status: refreshed 2026-03-20 for the current Synology live deployment. Use [Synology Operations Runbook](synology-operations-runbook.md) for live NAS operations. Treat [DEPLOYMENT.md](../DEPLOYMENT.md) as legacy/bootstrap reference only.

This index provides a comprehensive reference for the brownfield Family Learning Hub project. It's designed for AI-assisted development: understanding existing code, extending features, or planning migrations.

## Quick Reference
- **Project Type**: Monorepo (multi-part: web frontend + backend API)
- **Tech Stack**:
  - Frontend: React 18 / TypeScript / Vite / Tailwind CSS / PWA
  - Backend: Node.js / Express 4 / TypeScript / Better-SQLite3 / JWT Auth
- **Database**: SQLite (family.db) - Profiles central; gamification/diet/school modules
- **Deployment**: Docker Compose (backend:3001, frontend:3000)
- **Key Integrations**: Grok AI (chat), Web Push (notifications), Planned: Matvaretabellen (foods)

## Getting Started
See [Development Guide](development-guide.md) for setup, run, test, deploy.
See [Synology Operations Runbook](synology-operations-runbook.md) for the current live NAS deployment, SSH path, and safe deploy workflow.

## Core Documentation

### Project Structure
- [Source Tree Analysis](source-tree-analysis.md) - Directory layout with annotations and integration points.

### Backend (API)
- [Architecture](architecture-backend.md) - Layers (routes/services/DB), decisions, flow examples.
- [Data Models](data-models-backend.md) - Full schema (tables, relationships, indexes).
- [API Contracts](api-contracts-backend.md) - All endpoints (methods, auth, request/response).

### Frontend (Web App)
- [Architecture](architecture-frontend.md) - Routing, state (Context), components, PWA.
- [UI Component Inventory](ui-component-inventory-frontend.md) - Reusable components by category.

### Cross-Part
- [Integration Architecture](integration-architecture.md) - API flows, auth, external deps (AI, push).

### Supporting
- [Project Overview](project-overview.md) - High-level goals, status, summary.
- [Synology Operations Runbook](synology-operations-runbook.md) - Current live deployment state, SSH usage, Docker commands, and safe cherry-pick deploy steps.
- [Stability Notes 2026-03-26](stability-notes-2026-03-26.md) - Operational note for the quiz recovery and scheduled-task behavior fixes.

## Existing Documentation (Discovered)
- [README.md](../README.md) - General project info.
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Legacy/bootstrap deployment guide; not the current live Synology procedure.
- [QUICKSTART.md](../QUICKSTART.md) - Initial setup.
- [PWA_SETUP.md](../PWA_SETUP.md) - PWA config.
- [RBAC_IMPLEMENTATION.md](../RBAC_IMPLEMENTATION.md) - Role-based access.
- [SECURITY_AND_FEATURES_FIX_PLAN.md](../SECURITY_AND_FEATURES_FIX_PLAN.md) - Security roadmap.
- [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) - Dev progress.

No additional docs in docs/ or subfolders beyond generated.

## Next Steps
- For brownfield PRD: Run BMAD PRD workflow, reference this index.md as input.
- Extend: Add to backend/routes/ for new API; frontend/pages/ for UI.
- Issues: See SECURITY_AND_FEATURES_FIX_PLAN.md; test coverage low.

All docs generated via document-project workflow (initial_scan, deep level).
