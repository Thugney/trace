# Story 3.2: Age-Appropriate Dynamic Quiz Themes

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a kid taking quizzes,
I want themes that match my age and interests (cartoon for ages 5-8, realistic for ages 9-12),
so that quizzes feel engaging and personally relevant to my developmental stage.

## Acceptance Criteria

**Given** my age is recorded in my ProfileContext (e.g., 7 years old)
**When** I start a quiz
**Then** the quiz automatically uses cartoon-themed visuals (bright colors, playful elements)
**And** the theme persists throughout my quiz session

**Given** my age is recorded in my ProfileContext (e.g., 11 years old)
**When** I start a quiz
**Then** the quiz automatically uses realistic-themed visuals (mature colors, realistic imagery)
**And** the theme matches my developmental level

**Given** the theme system is active
**When** I view quiz questions and answers
**Then** all visual elements (backgrounds, buttons, progress indicators) follow the age-appropriate theme
**And** the theme enhances rather than distracts from the learning content

**Given** I have siblings of different ages using the same device
**When** we switch profiles
**Then** the quiz themes automatically adjust to each child's age
**And** each child experiences quizzes tailored to their age group

**Given** a theme is applied to a quiz
**When** I answer questions
**Then** feedback animations and visual rewards also follow the theme style
**And** the overall experience feels cohesive and engaging

**Given** parents want to preview or adjust theme settings
**When** they access quiz settings
**Then** they can see which theme will be applied based on each child's age
**And** they can override the automatic theme selection if desired (with educational rationale)

## Tasks / Subtasks

- [x] Implement age-based theme selection (AC: cartoon for 5-8, realistic for 9-12)
  - [x] Use AgeContext in QuizPlayer.tsx to determine theme based on profile age
  - [x] Define theme configs (colors, images) for cartoon (bright/playful) and realistic (mature)
  - [x] Apply theme classes via Tailwind (e.g., bg-gradient-to-r from-blue-400 to-purple-600 for cartoon)
- [x] Apply theme to visual elements (AC: backgrounds, buttons, progress)
  - [x] Update QuizPlayer CSS with dynamic classes from theme (background, button styles)
  - [x] Integrate theme for progress indicator and question containers
  - [x] Ensure theme persistence across questions (state in Context)
- [x] Handle profile switch (AC: adjust on switch)
  - [x] Listen to ProfileContext changes in QuizPlayer to re-apply theme
  - [x] Clear and reload theme on profile change mid-quiz if needed
- [x] Theme feedback and rewards (AC: animations follow theme)
  - [x] Extend feedback animations (from 3.3) with theme-specific styles (e.g., cartoon confetti vs realistic checkmark)
  - [x] Use CSS vars for theme colors in animations
- [x] Parent preview/override (AC: settings view)
  - [x] Add theme preview in Settings.tsx showing age-based examples
  - [x] Allow override toggle per child in parent settings, store in profile
  - [x] Fallback to override if set, else auto from age
- [x] Accessibility and responsive (cross-cutting)
  - [x] Ensure theme contrast >4.5:1 (WCAG from 5.1)
  - [x] Responsive theme elements with Tailwind breakpoints
  - [x] Test for color vision deficiencies

## Dev Notes

- Relevant architecture patterns and constraints: Client-side theming via Context (no server render). Integrate with QuizPlayer from 2.2 and readability from 3.1. Use Tailwind for dynamic classes. Age from ProfileContext/AgeContext. Override in settings via API /profiles/{id}/theme. Ensure themes don't affect performance (CSS only).
- Source tree components to touch: frontend/src/pages/QuizPlayer.tsx (theme application), frontend/src/context/AgeContext.tsx (theme logic), frontend/src/pages/Settings.tsx (preview/override), frontend/src/index.css (theme vars).
- Testing standards summary: Vitest for theme switching (mock age), snapshot for styled components, e2e for profile change and override. Cover contrast checks.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): Theme logic in Context, application in QuizPlayer. CSS vars in index.css. Naming: getAgeTheme, applyThemeClasses.
- Detected conflicts or variances (with rationale): Layers on 3.1 readability; ensure theme doesn't override font/contrast settings.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Success Criteria]: Personalized learning for 85% completion.
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Color System]: Blues/greens for themes, playful for kids.
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns]: Client-side personalization.
- [Source: frontend/src/context/ProfileContext.tsx]: Base for age/theme.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

### File List

- frontend/src/pages/QuizPlayer.tsx (modified)
- frontend/src/context/AgeContext.tsx (modified)
- frontend/src/pages/Settings.tsx (modified)
- frontend/src/index.css (modified)