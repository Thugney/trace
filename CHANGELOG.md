# Changelog

## [Unreleased] - 2025-12-31

### Added
- **Quiz AI Provider Choice**: Quiz Builder can select Grok or OpenAI for image generation.
- **OpenAI Image Support**: Added OpenAI image generation (gpt-image-1) with base64 handling and storage.
- **Async AI Quiz Jobs**: AI quiz generation now runs as background jobs with status polling to avoid Cloudflare timeouts.

### Fixed
- **Docker Access Issues**: Backend now explicitly binds to 0.0.0.0 for external accessibility
- **API Connection**: Frontend now uses nginx proxy with relative `/api` paths instead of hardcoded localhost URLs
- **Network Configuration**: Fixed docker-compose environment variables for proper container-to-container communication
- **Quiz Media Auth**: Public quiz media route to prevent 401s for AI-generated images during play.
- **Quiz Theme Crash**: Fallback theme merge prevents undefined theme fields from crashing the player.
- **Quiz Readability**: Header, score, and feedback text now adapt to light themes for visibility.
- **Quiz Audio**: Replaced buzzing ambient pad with a softer chime.
- **AI Generation Timeouts**: Job polling prevents 524 errors when AI takes too long.

### Changed
- **AI Image Prompts**: Improved kid-friendly prompt template, with retries/backoff for reliability.
- **AI Images Scope**: Option images disabled; generate question-only images for higher success rate.
- **Docker Env**: Added `OPENAI_API_KEY` pass-through in docker-compose.

### Updated
- **Frontend Dependencies**: Updated all packages to latest stable versions
  - React: 18.2.0 → 18.3.1
  - React Router: 6.21.1 → 6.28.0
  - Vite: 5.0.11 → 6.0.5
  - TypeScript: 5.3.3 → 5.7.2
  - Axios: 1.6.5 → 1.7.9
  - Recharts: 2.10.3 → 2.15.0
  - lucide-react: 0.303.0 → 0.469.0
  - date-fns: 3.0.6 → 4.1.0
  - ESLint: 8.56.0 → 9.18.0
  - And more...

- **Backend Dependencies**: Updated all packages to latest stable versions
  - Express: 4.18.2 → 4.21.2
  - Helmet: 7.1.0 → 8.0.0
  - better-sqlite3: 9.2.2 → 11.8.1
  - TypeScript: 5.3.3 → 5.7.2
  - Axios: 1.6.5 → 1.7.9
  - express-rate-limit: 7.1.5 → 7.5.0
  - @types/node: 20.10.6 → 22.10.5
  - tsx: 4.7.0 → 4.19.2
  - And more...

### Added
- **DOCKER_TROUBLESHOOTING.md**: Comprehensive guide for debugging Docker deployment issues
- **Enhanced Logging**: Backend now shows bind address and environment on startup
- **Better Documentation**: Updated QUICKSTART.md with troubleshooting references

### Changed
- **API Configuration**: Frontend API client now intelligently uses relative paths in production
- **Docker Environment**: Simplified VITE_API_URL configuration in docker-compose.yml

## [1.0.0] - 2024-12-XX

### Added
- Initial release
- Family Management PWA with diet tracking
- Kids task management system
- Grok AI integration
- Docker deployment support
- Synology NAS compatibility
