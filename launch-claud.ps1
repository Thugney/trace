# Copy and paste this FIXED version
@'
# launch-claude.ps1 - Complete Agentic Setup (FIXED)
# Usage: .\launch-claude.ps1

Write-Host "`n=== CLAUDE CODE - FULL AGENTIC MODE ===" -ForegroundColor Cyan
Write-Host "Stop Hooks: ENABLED (continues until all tasks done)" -ForegroundColor Green
Write-Host "Max Iterations: 100" -ForegroundColor Green
Write-Host "Skills: All Anthropic skills available" -ForegroundColor Green
Write-Host "Environment: Alpha Dev (Local Docker + Database)`n" -ForegroundColor Yellow

# Check prerequisites
if (!(Test-Path "todo.md")) {
    Write-Host "ERROR: todo.md not found!" -ForegroundColor Red
    Write-Host "Create todo.md in this directory first.`n" -ForegroundColor Yellow
    exit 1
}

# Show incomplete tasks
$incompleteTasks = (Select-String -Path "todo.md" -Pattern "^- \[ \]" -AllMatches).Matches.Count
Write-Host "Incomplete tasks found: $incompleteTasks`n" -ForegroundColor Yellow

if ($incompleteTasks -eq 0) {
    Write-Host "All tasks are complete! Nothing to do.`n" -ForegroundColor Green
    exit 0
}

# Confirm start
Write-Host "Ready to start Claude in agentic mode." -ForegroundColor Cyan
$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Cancelled.`n" -ForegroundColor Red
    exit 0
}

Write-Host "`nStarting Claude...`n" -ForegroundColor Green

# Create the prompt file
$promptFile = ".claude-prompt.txt"
$prompt = @"
=== AGENTIC MODE - FULL CAPABILITIES ENABLED ===

ENVIRONMENT:
- Project: Trace (Family Task Management App)
- Location: $(Get-Location)
- Backend: Docker container, port 3001
- Frontend: Docker container, port 3000
- Database: SQLite at ./data/family.db (local alpha environment)
- Stop hooks: ENABLED (you will continue working until ALL tasks complete)
- Max iterations: 100

YOUR CAPABILITIES:
✓ Read/write files across entire project
✓ Run bash commands and Docker commands
✓ Execute tests (npm test, docker-compose exec)
✓ Commit to git when features are complete
✓ Access all Anthropic skills at /mnt/skills/public/
  - docx: Word document creation
  - xlsx: Excel spreadsheet creation
  - pptx: PowerPoint presentations
  - pdf: PDF manipulation

WORKFLOW RULES:
1. Read todo.md - work through tasks in order
2. For EACH task:
   a) Make code changes
   b) Test in Docker: docker-compose up -d
   c) Run tests: docker-compose exec backend npm test
   d) Verify functionality works
   e) Mark task [x] in todo.md when complete
   f) Commit with descriptive message
3. Continue to next task automatically
4. Stop hook will restart you if tasks remain

TESTING REQUIREMENTS:
- Backend tests must pass before marking complete
- Docker containers must start successfully
- No console errors
- Actual functionality must work (not just compile)

GIT WORKFLOW:
- Commit each completed feature separately
- Use descriptive messages: "Fix: [what]" or "Feature: [what]"
- Check git status before committing

DATABASE:
- Local SQLite at ./data/family.db
- This is ALPHA environment (local testing)
- Full database access for testing

START NOW:
Read todo.md and begin working on the first unchecked task.
Work systematically. Test thoroughly. The stop hook will keep you going.
"@

Set-Content -Path $promptFile -Value $prompt

# Launch Claude with the prompt
& claude $prompt

# Cleanup
Remove-Item $promptFile -ErrorAction SilentlyContinue
'@ | Set-Content launch-claude.ps1