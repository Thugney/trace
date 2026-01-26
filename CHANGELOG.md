# Changelog

All notable changes to Family Hub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-26

### 🎉 Initial Release

This is the first official versioned release of Family Hub, a comprehensive multi-family management platform.

### Core Features

#### Family Management
- Multi-family support with two access tiers (Family A: Full Access, Family B: Church School Only)
- Parent and child profile management
- Family-specific settings and preferences
- Admin panel for system-wide management

#### Task Management
- Create, assign, and track tasks for family members
- Photo proof system for task completion
- Timer support for timed tasks
- Recurring task scheduling
- Task categories and priorities

#### Gamification & Rewards
- Points system for task completion
- Economy controls to prevent abuse
- Achievement badges and milestones
- Leaderboards (family and school levels)
- Streak tracking and bonuses

#### Church School Module
- Teacher portal with class management
- Student enrollment and tracking
- Assignment creation and grading
- Attendance tracking
- Parent progress views
- Teacher-parent communication

#### AI-Powered Features
- Book creation with AI (Ollama, Gemini, Grok, OpenAI)
- Custom book generation instructions
- AI-generated quizzes
- Multiple AI provider fallback support

#### Book Library
- Digital book library with reading progress
- Physical book tracking
- Reading history and stats
- Parent view of children's reading

#### Calendar & Scheduling
- Family calendar with event management
- Task-specific scheduled reminders
- Morning, evening, and weekly notification schedules

#### Push Notifications
- Web push notification support
- Profile-based reminder preferences
- Task reminder notifications
- Sound effects for notifications

#### Shopping Lists
- Family shopping list management
- Permission-based list creation for children
- Shopping helper assignment

#### Settings & Administration
- User settings and preferences
- Security settings
- Admin controls for family and profile creation
- Feature toggles per family
- Ollama AI configuration

### Technical Features
- Progressive Web App (PWA) support
- Responsive design for mobile and desktop
- SQLite database with migrations
- Express.js backend with TypeScript
- React frontend with Vite
- Docker containerization support

---

## Version History Format

Future releases will follow this format:

### [X.Y.Z] - YYYY-MM-DD

#### Added
- New features

#### Changed
- Changes to existing functionality

#### Deprecated
- Features to be removed in future versions

#### Removed
- Removed features

#### Fixed
- Bug fixes

#### Security
- Security updates
