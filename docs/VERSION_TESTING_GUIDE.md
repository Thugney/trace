# Version Testing Guide

This guide explains how to test different versions of Family Hub and how versioning works.

## Current Versions

| Version | Tag | Status | Description |
|---------|-----|--------|-------------|
| 1.0.0 | `v1.0.0` | Stable | Initial release - core features |
| 1.1.0 | `v1.1.0` | Latest | Added Activity Builder & Quiz Builder |

---

## For Testers: How to Switch Versions

### View Available Versions
```bash
git fetch --all --tags
git tag -l
```

### Switch to a Specific Version
```bash
# Example: Switch to v1.1.0
git fetch --all --tags
git checkout v1.1.0

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Rollback to Previous Version
```bash
# Example: Rollback to v1.0.0
git checkout v1.0.0
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Return to Latest Development
```bash
git checkout feature/school-leaderboard  # or main branch
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## For Developers: Version Management

### Semantic Versioning (SemVer)

Format: `MAJOR.MINOR.PATCH`

| Change Type | When to Use | Example |
|-------------|-------------|---------|
| **PATCH** (x.x.1) | Bug fixes, security fixes | 1.0.0 → 1.0.1 |
| **MINOR** (x.1.0) | New features (backwards compatible) | 1.0.0 → 1.1.0 |
| **MAJOR** (2.0.0) | Breaking changes | 1.0.0 → 2.0.0 |

### Bump Version Commands
```bash
# Bug fix release
npm run version:patch   # 1.0.0 → 1.0.1

# New feature release
npm run version:minor   # 1.0.0 → 1.1.0

# Breaking change release
npm run version:major   # 1.0.0 → 2.0.0
```

**Note:** Git working directory must be clean before running these commands.

### Manual Version Update
If npm version commands fail, update manually:
1. Edit `package.json` (root, backend, frontend)
2. Update version in all three files
3. Update `README.md` version badge
4. Update `CHANGELOG.md`

### Creating a Release Tag
```bash
# Create annotated tag
git tag -a v1.2.0 -m "Release v1.2.0 - Description of changes"

# Push tag to remote
git push origin v1.2.0
```

### Deleting a Tag (if needed)
```bash
# Delete local tag
git tag -d v1.2.0

# Delete remote tag
git push origin --delete v1.2.0
```

---

## Pre-release Versions (Beta Testing)

For features that need testing before stable release:

| Tag Format | Meaning | Example |
|------------|---------|---------|
| `v1.2.0-alpha.1` | Early testing, unstable | First alpha |
| `v1.2.0-beta.1` | Feature complete, testing | First beta |
| `v1.2.0-beta.2` | Bug fixes from beta.1 | Second beta |
| `v1.2.0-rc.1` | Release candidate | Almost ready |
| `v1.2.0` | Stable release | Production ready |

### Creating a Beta Release
```bash
# Create beta tag
git tag -a v1.2.0-beta.1 -m "Beta release v1.2.0-beta.1 - Testing new features"
git push origin v1.2.0-beta.1
```

### Testers Switch to Beta
```bash
git fetch --all --tags
git checkout v1.2.0-beta.1
docker-compose down && docker-compose build --no-cache && docker-compose up -d
```

---

## Release Checklist

Before creating a new release:

1. [ ] All features tested locally
2. [ ] Build passes: `npm run build`
3. [ ] Docker builds: `docker-compose build`
4. [ ] Update version in `package.json` (root, backend, frontend)
5. [ ] Update `README.md` version badge
6. [ ] Update `CHANGELOG.md` with changes
7. [ ] Commit all changes
8. [ ] Create git tag
9. [ ] Push commits and tag to remote

---

## Files That Track Version

| File | What to Update |
|------|----------------|
| `package.json` | `"version": "x.x.x"` |
| `backend/package.json` | `"version": "x.x.x"` |
| `frontend/package.json` | `"version": "x.x.x"` |
| `README.md` | Version badge |
| `CHANGELOG.md` | Release notes |

---

## Quick Reference

```bash
# See current version
cat package.json | grep '"version"'

# See all tags
git tag -l

# See tag details
git show v1.1.0

# Compare versions
git diff v1.0.0..v1.1.0 --stat
```
