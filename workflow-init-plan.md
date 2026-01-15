# BMAD Workflow Initialization Plan

## Overview
This plan outlines the steps to initialize BMAD workflows in the project. BMAD (_bmad directory) provides agent orchestration, tasks, and workflows like brainstorming and party-mode. The system appears partially configured with manifests for agents, tasks, tools, and workflows. Initialization focuses on validation, dependency setup, and activation for use in development or production.

Current BMAD Status:
- Version: 6.0.0-alpha.22 (from manifest.yaml)
- Modules: core
- IDEs: claude-code, roo
- Workflows: brainstorming, party-mode
- No custom workflows detected; standard core workflows are available.

## Prerequisites
- Node.js >=18 installed
- Docker and Docker Compose for containerized setup (if deploying)
- Git for version control
- Access to VS Code with extensions for TypeScript, React, and any BMAD-specific tools

## Initialization Sequence

### 1. Install Project Dependencies
Install backend and frontend dependencies to ensure the environment supports BMAD integrations (e.g., API routes for AI/gamification that may interact with workflows).

- Backend:
  ```
  cd backend
  npm install
  ```
- Frontend:
  ```
  cd frontend
  npm install
  ```

### 2. Validate BMAD Configurations
Review and validate manifests to ensure consistency.

- Check manifests:
  - agent-manifest.csv: Verify agent definitions (e.g., bmad-master)
  - task-manifest.csv: Ensure tasks like workflow.xml are listed
  - tool-manifest.csv: Confirm tools availability
  - workflow-manifest.csv: Validate workflows (brainstorming, party-mode)
- Run validation script if available (none detected; manual check via reading files):
  - Use VS Code to open and inspect _bmad/_config/*.csv and core/*.xml/md files
  - Ensure no syntax errors in YAML/CSV/XML

### 3. Set Up Environment
- Copy environment files:
  ```
  cp .env.example .env
  # Edit .env: Add GROK_API_KEY if using AI workflows
  ```
- For Docker (Synology NAS compatible):
  ```
  docker-compose up -d --build
  ```

### 4. Run Seed and Setup Scripts
- Database seeding (if BMAD uses DB for state):
  ```
  cd backend
  node seed-database.js  # Seeds initial profiles/tasks
  ```
- BMAD-specific setup:
  - No explicit init script found; activate by referencing workflows in tasks (e.g., use brainstorming workflow in planning sessions)
  - Run validation tasks:
    ```
    # If BMAD CLI available (not detected), run: bmad validate-workflow
    # Manual: Review core/tasks/validate-workflow.xml
    ```

### 5. Activate Workflows
- Integrate BMAD into development:
  - Use workflows via VS Code tasks or scripts (e.g., launch-claude.ps1 for IDE integration)
  - For brainstorming: Reference _bmad/core/workflows/brainstorming/workflow.md in planning
  - For party-mode: Use for multi-agent discussions
- Test activation:
  - Start local dev servers:
    ```
    # Backend
    cd backend && npm run dev
    # Frontend
    cd frontend && npm run dev
    ```
  - Access: http://localhost:3000 (frontend), http://localhost:3001 (API)

### 6. Validation and Testing
- Verify:
  - Docker containers running: `docker-compose ps`
  - API endpoints respond: `curl http://localhost:3001/api/profiles`
  - BMAD workflows load without errors (manual test by following workflow.md steps)
- Logs: `docker-compose logs -f` or console output
- If issues: Refer to SETUP_AND_TROUBLESHOOTING.md and DOCKER_TROUBLESHOOTING.md

## Potential Risks and Mitigations
- Missing API keys: Prompt user for GROK_API_KEY
- Config inconsistencies: Manually edit manifests if needed
- Docker on Synology: Ensure ports 3000/3001 open; use host network if conflicts

## Next Steps After Initialization
- Switch to code mode for implementation if needed
- Update progress.md (if Memory Bank active) or todo.md
- Run specific workflows (e.g., brainstorming for feature planning)

This plan ensures a structured, repeatable initialization. Execute steps sequentially.