---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# trace - User Stories

This document contains all user stories extracted from the epics, organized under their respective epic headers for context. Each story includes acceptance criteria.

## Epic 1: Family Task Oversight Foundation

Parents can review and approve kids' task proofs with manual approval, timestamp verification, and notifications.
**FRs covered:** FR1, FR8, FR9, FR10, FR12, FR15, FR16
**User value:** Parents gain visibility and control over kids' task completion, building trust through manual proof approval.

### Story 1.1: Kid Proof Upload Flow

As a kid completing a task,
I want to upload a photo proof with one-tap camera access to local Docker Synology storage,
So that I can provide visual evidence of task completion to my parents and eventually earn points/rewards upon approval.

**Acceptance Criteria:**

**Given** I am on the task completion screen for an assigned task
**When** I tap the "Add Photo Proof" button
**Then** the device camera opens immediately for photo capture
**And** I can take a photo or choose from gallery

**Given** I have captured or selected a photo
**When** I confirm the photo selection
**Then** the photo is uploaded to local Docker Synology storage
**And** a proof record is created in the PostgreSQL database with task ID, timestamp, and pending status
**And** I see a "Proof Uploaded Successfully" confirmation

**Given** the upload completes
**When** I return to the task list
**Then** the task shows a "Proof Pending" status indicator
**And** the proof thumbnail appears next to the task

**Given** I have poor or no internet connection
**When** I attempt to upload a proof
**Then** the proof is queued locally via service worker
**And** I see an "Uploading when connected" message
**And** the upload automatically resumes when connectivity is restored

### Story 1.2: Parent Dashboard with Pending Proofs & Progress Overview

As a parent,
I want to see a dashboard with my kids' pending proofs, progress metrics, and the ability to create/assign tasks,
So that I can oversee their activities, track completion, and manage their responsibilities.

**Acceptance Criteria:**

**Given** I am logged in as a parent
**When** I navigate to the parent dashboard
**Then** I see a "Pending Proofs" section with thumbnail previews of proofs needing approval
**And** I see a "Kids Progress" section showing completion rates, streaks, and recent activity for each child

**Given** there are multiple kids in my family
**When** I view the dashboard
**Then** I only see data for my own children (RBAC enforcement)
**And** each child has their own progress card with their name and photo

**Given** I want to create a new task for a child
**When** I tap the "Create Task" button in the dashboard
**Then** I can enter task details (title, description, due date, point value)
**And** I can select which child to assign the task to from a dropdown of my kids

**Given** I have created a task
**When** I assign it to a child
**Then** the task appears in that child's task list
**And** the child receives a notification about the new assigned task
**And** the task is recorded in the database with my parent ID as creator

**Given** a child has created their own task (existing functionality)
**When** I view the dashboard
**Then** I can see both parent-assigned and child-created tasks in their progress metrics
**And** I can distinguish between task types (assigned vs self-created)

**Given** new proofs are uploaded or tasks are completed
**When** polling updates occur (every 30s)
**Then** the dashboard refreshes with updated proof counts and progress metrics
**And** I see visual indicators for new activity

**Given** I have no pending proofs or active tasks
**When** I view the dashboard
**Then** I see encouraging messages and suggestions for engaging with my kids
**And** I see quick-action buttons for common task templates

### Story 1.3: Proof Review Interface with Timestamps & Notes

As a parent,
I want to review proof details with full-size images, timestamps, and the ability to add notes,
So that I can make informed decisions about approval based on complete evidence.

**Acceptance Criteria:**

**Given** I am on the parent dashboard with pending proofs
**When** I tap on a proof thumbnail
**Then** I am taken to a detailed proof review interface
**And** the proof image loads instantly in full-size view

**Given** I am viewing a proof
**When** the interface loads
**Then** I see the task name, child's name, and upload timestamp
**And** I see start/stop timestamps if the task had timer tracking (from Epic 2)
**And** I see the total duration if timer data is available

**Given** I want to examine the proof closely
**When** I view the proof image
**Then** I can pinch-to-zoom for detailed inspection
**And** I can swipe left/right to navigate between proofs if multiple are pending

**Given** I want to add context to my review
**When** I tap the "Add Note" field
**Then** I can type notes about the proof
**And** the notes are saved temporarily as I type (auto-save)

**Given** I have added notes to a proof
**When** I navigate away from the proof review
**Then** my notes are preserved with the proof record
**And** I can see my notes when I return to this proof

**Given** the proof image fails to load
**When** I view the proof review interface
**Then** I see a fallback thumbnail and error message
**And** I have an option to retry loading the image

**Given** I want to compare proof details
**When** I view the proof review interface
**Then** I can see related task details (original description, due date, point value)
**And** I can see the child's recent proof history for similar tasks

### Story 1.4: Proof Approval/Rejection with Swipe Gestures & Rewards

As a parent,
I want to approve or reject proofs with swipe gestures, add comments, and award points/rewards upon approval,
So that I can provide feedback, maintain accountability, and motivate my kids through the reward system.

**Acceptance Criteria:**

**Given** I am reviewing a proof in the proof review interface
**When** I want to approve the proof
**Then** I can swipe right or tap an "Approve" button
**And** I have the option to add an approving comment before confirming

**Given** I am reviewing a proof in the proof review interface
**When** I want to reject the proof
**Then** I can swipe left or tap a "Reject" button
**And** I am required to provide constructive feedback explaining the rejection

**Given** I have approved a proof
**When** I confirm the approval
**Then** the proof status changes to "Approved" in the database
**And** the child receives the task's point value in their reward balance
**And** the child gets a push notification about the approval and points earned
**And** the task is marked as completed in the child's task list

**Given** I have rejected a proof
**When** I confirm the rejection with feedback
**Then** the proof status changes to "Rejected" in the database
**And** my feedback is saved with the proof record
**And** the child receives a push notification with my feedback
**And** the task remains in the child's task list with "Needs Revision" status

**Given** I want to provide detailed feedback
**When** I approve or reject a proof
**Then** I can type comments in a text field
**And** I can use preset feedback templates for common situations
**And** my comments are saved with the approval/rejection decision

**Given** a proof has been approved or rejected
**When** I return to the parent dashboard
**Then** the proof is removed from the "Pending Proofs" section
**And** the child's progress metrics update to reflect the completion

**Given** multiple proofs are pending for the same child
**When** I use swipe gestures to approve/reject proofs
**Then** I can quickly process multiple proofs in sequence
**And** after each decision, I automatically advance to the next pending proof

**Given** I accidentally approve or reject a proof
**When** I realize my mistake immediately
**Then** I have a brief undo period (5 seconds) to reverse the decision
**And** I can correct my decision without the child being notified

### Story 1.5: Proof Status Polling & Real-time Sync

As a parent or kid,
I want real-time updates on proof status changes with reliable polling and offline support,
So that both parents and kids see synchronized status without manual refreshing.

**Acceptance Criteria:**

**Given** I am a parent viewing the dashboard or proof review interface
**When** a child uploads a new proof or I approve/reject a proof
**Then** status updates propagate to all connected devices within 30 seconds via polling
**And** I see visual indicators (badges, notifications) for new activity

**Given** I am a kid waiting for proof approval
**When** a parent approves or rejects my proof
**Then** I receive a push notification within 30 seconds of the decision
**And** my task list updates to show the new status (approved/completed or needs revision)

**Given** the polling mechanism is active
**When** I am online
**Then** my device polls the server every 30 seconds for proof status updates
**And** only changed data is fetched to minimize bandwidth usage

**Given** I lose internet connectivity
**When** proofs are approved/rejected or new proofs are uploaded
**Then** changes are queued locally via service worker
**And** sync resumes automatically when connectivity is restored
**And** I see an "Offline - Changes will sync when connected" indicator

**Given** multiple devices are logged into the same account
**When** proof status changes on one device
**Then** all other devices reflect the change after the next polling cycle
**And** there are no race conditions or conflicting status updates

**Given** I want to manually force a sync
**When** I pull down to refresh on the dashboard or task list
**Then** an immediate sync check is performed
**And** I see a loading spinner during the sync
**And** the interface updates with the latest data

**Given** there is a sync conflict (e.g., proof approved on one device, rejected on another)
**When** the conflict is detected
**Then** the most recent decision wins based on timestamp
**And** a conflict resolution log is recorded for audit purposes
**And** affected users are notified of the resolution

### Story 1.6: Task Completion Validation & Anti-Cheating

As a parent,
I want time-based validation on morning routine task completion with parent override capability,
So that kids can't cheat by marking tasks complete during school/church hours while allowing legitimate exceptions.

**Acceptance Criteria:**

**Given** I have created a "Morning Routine" category task (from Story 1.2 update)
**When** a kid attempts to mark it as complete on a weekday (Monday-Friday)
**Then** completion is blocked between 8:00 AM - 2:00 PM (school hours)
**And** the kid sees a clear error: "Morning tasks can only be completed after 2:00 PM on school days"

**Given** I have created a "Morning Routine" category task
**When** a kid attempts to mark it as complete on a weekend (Saturday-Sunday)
**Then** completion is blocked before 2:00 PM (church/activity time)
**And** the kid sees a clear error: "Morning tasks can only be completed after 2:00 PM on weekends"

**Given** a kid legitimately needs to complete a morning task outside allowed hours
**When** a parent accesses the task completion interface
**Then** the parent can override the time restriction with PIN or biometric authentication
**And** the override is logged with timestamp and parent ID for audit purposes

**Given** the time validation system is active
**When** a kid attempts to complete any task
**Then** the system checks local device timezone and adjusts for daylight saving
**And** validation uses the family's local time, not server time

**Given** multiple failed completion attempts occur
**When** a parent views the task history
**Then** they can see audit logs of blocked attempts with timestamps
**And** they can see which tasks had override completions by parents

**Given** a "Timed Work" or "Checklist" category task (non-morning routine)
**When** a kid attempts to complete it
**Then** no time-based restrictions apply (unless specifically configured by parent)
**And** completion follows normal workflows for those task types

**Given** the anti-cheating system is in place
**When** kids use the app daily
**Then** they develop honest completion habits without gaming the system
**And** parents have confidence in the integrity of task completion data

## Epic 2: Time Tracking & Sync System

Kids can track time on tasks and quizzes with reliable start/stop/pause controls, duration logging, and cross-device sync.
**FRs covered:** FR2, FR7, FR13, FR18, FR19
**User value:** Accurate time measurement for tasks and quizzes with offline support and device synchronization.

### Story 2.1: Task Timer Foundation with Visual Progress

As a kid working on a timed work task (cleaning, homework, projects),
I want to start, stop, and pause a timer with clear visual feedback,
So that I can track how much time I spend on extended activities and manage my time effectively.

**Note:** This timer functionality only applies to "Timed Work" category tasks. "Morning Routine", "Checklist", and "Special/Project" tasks use different completion methods without timers.

**Acceptance Criteria:**

**Given** I am viewing a "Timed Work" category task in my task list
**When** I want to start working on the task
**Then** I see a "Start Timer" button on the task card
**And** I can tap it to begin timing with hours:minutes:seconds format

**Given** I am viewing a "Morning Routine", "Checklist", or "Special/Project" category task
**When** I look for timer controls
**Then** I do not see start/stop/pause timer buttons
**And** I see appropriate completion controls for that task type (checkboxes, simple completion, etc.)

**Given** a timer is running on a "Timed Work" task
**When** I need to take a break
**Then** I can tap a "Pause" button to temporarily stop the timer
**And** the timer preserves the elapsed time while paused
**And** I can tap "Resume" to continue timing from where I left off

**Given** a timer is running or paused on a Timed Work task
**When** I complete the task or want to stop timing
**Then** I can tap a "Stop" button to end the timer session
**And** the final duration is displayed on the task card
**And** I have the option to add a proof (links to Story 1.1)

**Given** a timer is active on a Timed Work task
**When** I view the task card
**Then** I see a visual progress indicator (progress bar, circular timer, or similar)
**And** I see the current elapsed time displayed prominently
**And** I see clear start/pause/stop controls with appropriate icons

**Given** I have multiple Timed Work tasks
**When** I start a timer on one Timed Work task
**Then** any other running timers are automatically paused
**And** I can only have one active timer at a time across all tasks

**Given** I navigate away from the task list while a timer is running
**When** I return to the app
**Then** the timer continues running in the background
**And** I see a notification or badge indicating the active timer
**And** I can quickly return to the timed task

**Given** I close the app completely while a timer is running
**When** I reopen the app
**Then** the timer state is restored from local storage
**And** I see a prompt asking if I want to resume the interrupted timer

### Story 2.2: Quiz Timer Integration with Pause for Thinking

As a kid taking a quiz,
I want to have a timer with pause functionality during quizzes,
So that I can manage my thinking time without pressure and improve my learning experience.

**Acceptance Criteria:**

**Given** I am taking a quiz in the QuizPlayer
**When** the quiz question is displayed
**Then** I see a timer counting down (or up) for the current question
**And** I have a "Pause" button to temporarily stop the timer for thinking time

**Given** I need more time to think about a quiz question
**When** I tap the "Pause" button
**Then** the timer stops counting
**And** I see a "Resume" button to continue timing when ready
**And** the question remains displayed while timer is paused

**Given** the quiz timer is paused
**When** I tap "Resume"
**Then** the timer continues from where it left off
**And** my total quiz time accurately reflects only active thinking time

**Given** I am taking a timed quiz
**When** the timer reaches zero (for countdown quizzes) or I complete the question
**Then** I automatically advance to the next question
**And** the timer resets for the new question

**Given** I navigate away from the quiz while a timer is running
**When** I return to the quiz
**Then** the timer state is preserved (paused or running as appropriate)
**And** I can continue from where I left off

**Given** the quiz has audio feedback enabled (from Epic 3)
**When** timer updates occur (every second)
**Then** optional chime sounds play for timer milestones (30s warning, etc.)
**And** audio feedback is coordinated with timer events

### Story 2.3: Timer Duration Logging for Analytics & Streaks

As a kid completing timed tasks or quizzes,
I want my timer durations logged to the backend,
So that my effort is recorded for progress tracking, streaks, and family analytics.

**Acceptance Criteria:**

**Given** I complete a Timed Work task with an active timer
**When** I stop the timer or mark the task as complete
**Then** the final duration is automatically logged to the backend via /tasks/timer-log API
**And** the duration is stored in the database with task ID, user ID, and timestamp

**Given** I complete a quiz with timer tracking
**When** I finish the quiz session
**Then** my total quiz time and per-question times are logged to the backend
**And** the data is associated with my quiz attempt record

**Given** timer duration data is being logged
**When** there is poor or no internet connectivity
**Then** duration logs are queued locally via service worker
**And** logs are automatically synced when connectivity is restored
**And** I see an indicator that logs are pending sync

**Given** timer duration logs are successfully sent to the backend
**When** I view my task or quiz history
**Then** I can see how much time I spent on each activity
**And** I can see trends in my time management over days/weeks

**Given** duration data is available in the backend
**When** the streak system processes completions (Epic 4)
**Then** timer durations are considered for streak calculations
**And** consistent time investment contributes to streak maintenance

**Given** parents view kid progress analytics
**When** they access reporting features
**Then** they can see time spent on tasks and quizzes per child
**And** they can identify patterns in time management and focus

### Story 2.4: Timer Sync & Cross-Device Polling

As a kid or parent using multiple devices,
I want timer states and duration data synchronized across all my devices via reliable polling,
So that I have consistent experience whether I'm on my tablet, phone, or computer.

**Acceptance Criteria:**

**Given** I am using the app on any device
**When** timer-related activity occurs (start, stop, pause, completion)
**Then** the device polls the server every 30 seconds to sync timer state
**And** updates propagate to all other connected devices within the polling cycle

**Given** I have the app open on multiple devices simultaneously
**When** I start or stop a timer on one device
**Then** all other devices reflect the change within 30 seconds
**And** there is no timer drift greater than 5 seconds between devices (NFR2)

**Given** the polling mechanism is active
**When** I perform actions while online
**Then** timer updates have less than 500ms latency to the server (NFR5)
**And** only changed data is transmitted to minimize bandwidth

**Given** I switch from one device to another while a timer is running
**When** I open the app on the new device
**Then** the current timer state is fetched immediately
**And** I can continue timing seamlessly from the new device

**Given** multiple family members are using timers simultaneously
**When** polling occurs
**Then** each user's timer data is synchronized independently
**And** there are no cross-user data leaks (RBAC enforcement)

**Given** I want to manually force a sync
**When** I pull down to refresh on any timer-related screen
**Then** an immediate sync check is performed
**And** I see visual feedback during the sync operation
**And** the interface updates with the latest timer states

### Story 2.5: Offline Timer Support with Service Worker Queuing

As a kid using the app in areas with poor or no internet connectivity,
I want timers to continue working offline with automatic queuing and sync,
So that I can track my time reliably regardless of network conditions.

**Acceptance Criteria:**

**Given** I start a timer on a Timed Work task or quiz
**When** I lose internet connectivity
**Then** the timer continues counting locally on my device
**And** I see an "Offline - Timer active" indicator

**Given** I complete a timed activity while offline
**When** I stop the timer or finish the activity
**Then** the duration data is queued locally via service worker
**And** I see a "Data queued for sync" notification

**Given** I have queued timer data from offline usage
**When** internet connectivity is restored
**Then** the service worker automatically syncs all queued data
**And** I receive confirmation that my offline data has been synchronized

**Given** I am completely offline (no connectivity)
**When** I use timer features
**Then** all timer functionality works locally
**And** I can view my offline timer history
**And** I can start/stop/pause timers as normal

**Given** I have multiple timed activities while offline
**When** connectivity is restored
**Then** all queued timer data is synced in chronological order
**And** duration logs are properly timestamped with original activity times

**Given** the app is installed as a PWA with service worker
**When** I use timer features
**Then** offline capabilities are automatically available
**And** the service worker handles all queuing and sync operations

**Given** I experience intermittent connectivity
**When** using timers
**Then** the app gracefully handles connection drops and restores
**And** no timer data is lost during connectivity fluctuations

## Epic 3: Engaging Quiz Experience

Kids experience age-appropriate, themed quizzes with audio feedback, clear readability, and parent-controlled topics.
**FRs covered:** FR4, FR5, FR6, FR14
**User value:** Personalized, engaging learning that adapts to child's age and parent's educational priorities.

### Story 3.1: Quiz UX Readability Improvements

As a kid taking quizzes,
I want clear, readable questions with appropriate fonts and high contrast,
So that I can focus on learning without struggling to read the content.

**Acceptance Criteria:**

**Given** I am taking a quiz in the QuizPlayer
**When** a question is displayed
**Then** the question text uses larger, age-appropriate font sizes (minimum 18px for kids)
**And** there is high contrast between text and background (minimum 4.5:1 ratio)

**Given** I have visual preferences or needs
**When** viewing quiz content
**Then** text is legible with clear typography (using Inter font family)
**And** adequate spacing is provided between question elements

**Given** I need to read longer quiz questions
**When** the question exceeds a certain length
**Then** the text is properly wrapped and scrollable if needed
**And** the reading experience remains comfortable

**Given** I am using the app in different lighting conditions
**When** taking quizzes
**Then** the high-contrast design ensures readability in bright or dim environments
**And** color choices accommodate common color vision deficiencies

**Given** the quiz interface includes images or diagrams
**When** they are displayed with questions
**Then** images have appropriate alt text for accessibility
**And** image sizing maintains readability without distortion

**Given** I complete a quiz question
**When** I move to the next question
**Then** transitions are smooth and don't cause visual strain
**And** focus indicators are clearly visible for keyboard navigation

### Story 3.2: Age-Appropriate Dynamic Quiz Themes

As a kid taking quizzes,
I want themes that match my age and interests (cartoon for ages 5-8, realistic for ages 9-12),
So that quizzes feel engaging and personally relevant to my developmental stage.

**Acceptance Criteria:**

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

### Story 3.3: Quiz Audio Feedback System

As a kid taking quizzes,
I want celebratory audio feedback for correct answers and chimes for timer updates,
So that I receive immediate, engaging feedback that enhances my learning experience.

**Acceptance Criteria:**

**Given** I answer a quiz question correctly
**When** my answer is validated
**Then** a celebratory tune plays from utils/sounds.ts
**And** the audio feedback matches the age-appropriate theme (playful vs. mature sounds)

**Given** I answer a quiz question incorrectly
**When** my answer is validated
**Then** gentle, encouraging sound plays (not punitive)
**And** I hear audio cues that help me learn from my mistake

**Given** a quiz timer is active (from Story 2.2)
**When** timer milestones are reached (30-second warning, etc.)
**Then** subtle chime sounds play to indicate time passing
**And** the chimes are non-distracting but informative

**Given** audio feedback is enabled
**When** I complete a quiz
**Then** appropriate completion music plays based on my score
**And** the audio celebration matches my performance level

**Given** I have hearing preferences or needs
**When** using the quiz system
**Then** I can adjust audio volume or mute sounds in settings
**And** visual feedback alternatives are provided when audio is disabled

**Given** multiple audio events occur in rapid succession
**When** I answer several questions quickly
**Then** audio feedback is properly queued and doesn't overlap unpleasantly
**And** the audio system handles concurrent sounds gracefully

**Given** the audio system uses utils/sounds.ts
**When** sounds are played
**Then** they load quickly and play without lag
**And** audio files are optimized for mobile performance and bandwidth

### Story 3.4: Parent-Controlled Quiz Topics via AI Prompts

As a parent,
I want to control quiz topics and focus areas using AI prompts in settings,
So that I can guide my child's learning toward relevant subjects and address specific educational needs.

**Acceptance Criteria:**

**Given** I am a parent logged into the app
**When** I navigate to the AI gamification settings (/ai-gamification/focus)
**Then** I can enter natural language prompts about quiz topics (e.g., "focus on multiplication tables," "Tigrinya vocabulary practice")
**And** I can select which child the topic focus applies to

**Given** I have set quiz focus topics for a child
**When** that child starts a quiz
**Then** the quiz content prioritizes questions related to the focus topics
**And** the AI system generates or selects appropriate questions based on my prompts

**Given** I want to adjust quiz focus over time
**When** I update the AI prompts in settings
**Then** the changes take effect for future quizzes
**And** I can see a history of previous focus topics and their effectiveness

**Given** the AI topic system is active
**When** quizzes are generated or selected
**Then** questions align with both the child's age/level and the parent-specified focus areas
**And** the system balances focus topics with general knowledge to maintain variety

**Given** I want to monitor the impact of topic focus
**When** I view my child's quiz performance
**Then** I can see progress metrics specifically for focus topic areas
**And** I can adjust prompts based on observed learning outcomes

**Given** multiple focus topics are specified
**When** quizzes are generated
**Then** the system intelligently mixes topics across quiz sessions
**And** each quiz feels fresh while still addressing learning priorities

**Given** the AI gamification endpoint is utilized
**When** processing parent prompts
**Then** the system respects privacy and data security boundaries
**And** quiz content remains educationally appropriate and culturally relevant

## Epic 4: Family Gamification & Progress

Families see shared streaks, optional competitions, and visual progress tracking integrated with task completion.
**FRs covered:** FR3, FR11
**User value:** Motivation through gamification and family bonding around shared accomplishments.

### Story 4.1: Task Completion Streak System

As a kid completing tasks daily,
I want to build and maintain streaks for consistent task completion,
So that I feel motivated by my progress and develop good habits through gamification.

**Acceptance Criteria:**

**Given** I complete at least one task per day
**When** I view my profile or dashboard
**Then** I see a visual streak counter showing my current consecutive days
**And** the streak counter updates immediately after daily completion

**Given** I have an active streak
**When** I miss a day without completing any tasks
**Then** my streak resets to zero
**And** I see encouraging messaging to start a new streak
**And** I receive suggestions for getting back on track

**Given** I maintain a streak for multiple days
**When** I reach milestone lengths (7 days, 30 days, etc.)
**Then** I receive special recognition or rewards
**And** I see celebratory animations for streak milestones

**Given** multiple kids in a family have streaks
**When** viewing family progress
**Then** each child's streak is displayed individually
**And** family-wide streak achievements are highlighted

**Given** I want to understand my streak history
**When** I view streak details
**Then** I can see a calendar view of my completion history
**And** I can identify patterns in my consistency

**Given** streaks are integrated with the point economy
**When** I maintain a streak
**Then** I earn bonus points for streak longevity
**And** the point rewards scale with streak length

### Story 4.2: Family Competition & Economy Integration

As a family member,
I want optional competitions and a point economy system integrated with task completion,
So that we can have friendly family challenges and tangible rewards for our efforts.

**Acceptance Criteria:**

**Given** the family competition feature is enabled by parents
**When** family members complete tasks
**Then** they earn points based on task difficulty and completion quality
**And** points contribute to individual and family leaderboards

**Given** points are earned through task completion
**When** I view my point balance
**Then** I can see my current points and recent earnings
**And** I understand how points translate to rewards or privileges

**Given** parents want to create friendly competitions
**When** they set up competition periods (weekly, monthly)
**Then** family members can participate in goal-based challenges
**And** competition results are displayed in a non-punitive, encouraging way

**Given** the point economy is active
**When** kids accumulate points
**Then** they can redeem points for agreed-upon rewards (screen time, special activities, etc.)
**And** redemption requires parent approval and logging

**Given** multiple kids in a family
**When** they participate in competitions
**Then** age-appropriate adjustments are made to ensure fairness
**And** the focus remains on personal improvement rather than comparison

**Given** competitions are optional
**When** families choose not to use competition features
**Then** the point economy still functions for individual motivation
**And** no family member feels pressured to compete

**Given** the economy system integrates with existing task completion
**When** tasks are approved (from Story 1.4)
**Then** points are automatically awarded based on pre-configured values
**And** point transactions are logged for transparency

### Story 4.3: Timer Data Integration for Streak Quality

As a kid putting consistent effort into timed tasks,
I want my timer duration data to influence streak calculations,
So that my streaks reflect not just completion but also quality time investment.

**Acceptance Criteria:**

**Given** I complete Timed Work tasks with duration logging (from Story 2.3)
**When** streak calculations occur
**Then** my consistent time investment contributes to streak "quality" metrics
**And** streaks consider both completion frequency and effort duration

**Given** I use timers for quiz sessions (from Story 2.2)
**When** quiz completion contributes to learning streaks
**Then** time spent on quizzes enhances my learning streak quality
**And** focused quiz time is recognized in progress tracking

**Given** timer duration data is available
**When** viewing my streak information
**Then** I can see not just how many days but how much time I've invested
**And** I receive recognition for consistent time investment patterns

**Given** I have variable time availability across days
**When** streak calculations consider timer data
**Then** shorter but consistent sessions still contribute positively to streaks
**And** the system recognizes that time investment varies naturally

**Given** parents view streak analytics
**When** they examine streak details
**Then** they can see both completion consistency and time investment patterns
**And** they can identify if kids are rushing through tasks vs. investing quality time

**Given** the streak system integrates timer data
**When** generating streak rewards or recognition
**Then** quality streaks (consistent time investment) receive enhanced rewards
**And** kids are encouraged to develop good time management habits

### Story 4.4: Family Progress Visualization & Celebrations

As a family,
I want to see our collective progress through visual dashboards and celebrations,
So that we can share accomplishments, build family bonding, and celebrate learning together.

**Acceptance Criteria:**

**Given** family members complete tasks and quizzes
**When** viewing the family progress dashboard
**Then** we see aggregated completion metrics, streaks, and point totals
**And** each family member's contributions are visually represented

**Given** the family achieves collective milestones
**When** we reach family-wide goals (e.g., 100 tasks completed together)
**Then** we see celebratory animations and recognition
**And** family members receive shared rewards or privileges

**Given** parents want to foster family bonding
**When** they view family progress
**Then** they can identify opportunities for collaborative activities
**And** they receive suggestions for family challenges or goals

**Given** family progress data is available
**When** displaying progress visualizations
**Then** charts and graphs are age-appropriate and understandable by all family members
**And** visualizations highlight growth and improvement over time

**Given** individual family members have different abilities and ages
**When** displaying family progress
**Then** comparisons are handled sensitively to avoid unhealthy competition
**And** the focus remains on collective achievement and personal growth

**Given** family celebrations occur for milestones
**When** achievements are recognized
**Then** celebration elements (confetti, sounds, messages) are family-appropriate
**And** celebrations create positive reinforcement for continued effort

**Given** the family progress system integrates with existing dashboards
**When** parents or kids view progress
**Then** they can toggle between individual and family views
**And** they understand how individual efforts contribute to family success

## Epic 5: Accessibility & Personalization Foundation

Universal accessibility, responsive design, age personalization, security compliance, and performance optimization for all family members.
**FRs covered:** FR17, FR20 + All NFRs (1-24) + Additional Requirements
**User value:** Reliable, accessible app that works for all family members across devices and abilities.

### Story 5.1: Universal Accessibility Compliance (WCAG AA)

As a family member with accessibility needs,
I want the app to be fully accessible with screen reader support, keyboard navigation, and high contrast,
So that everyone in our family can use the app regardless of abilities or preferences.

**Acceptance Criteria:**

**Given** I use a screen reader
**When** navigating the app
**Then** all interactive elements have appropriate ARIA labels and roles
**And** timer updates use ARIA live regions for real-time announcements (NFR12, NFR15)

**Given** I rely on keyboard navigation
**When** using the app
**Then** all functionality is accessible via keyboard (tab, enter, space, arrow keys)
**And** focus indicators are clearly visible for all interactive elements

**Given** I have visual preferences or color vision needs
**When** viewing the app interface
**Then** color contrast meets WCAG AA standards (minimum 4.5:1 for normal text)
**And** color is not used as the sole means of conveying information

**Given** I need larger text or different visual settings
**When** using the app
**Then** text scales properly with device text size settings
**And** the layout remains functional at increased text sizes

**Given** I have motor control differences
**When** interacting with touch targets
**Then** buttons and interactive elements have minimum 48px touch targets
**And** adequate spacing prevents accidental activation

**Given** multimedia content is present (audio feedback, images)
**When** accessing content
**Then** audio has visual alternatives and controls
**And** images have descriptive alt text where meaningful

**Given** the app is used in different accessibility contexts
**When** testing accessibility compliance
**Then** the app meets WCAG AA standards across all major user journeys
**And** accessibility testing is integrated into the development process

### Story 5.2: Responsive Mobile-First Design

As a family member using various devices,
I want the app to work perfectly on phones, tablets, and computers with responsive layouts,
So that I can use the app comfortably on any device I have available.

**Acceptance Criteria:**
- App uses Tailwind breakpoints (sm/md/lg) for responsive design
- All interfaces adapt to different screen sizes without loss of functionality
- Mobile-first design prioritizes touch interactions and mobile usability
- Layouts remain usable and attractive across device types

### Story 5.3: Age-Based Personalization System

As a family with kids of different ages,
I want UI elements, themes, sounds, and difficulty to adapt automatically to each child's age via ProfileContext,
So that each child has an age-appropriate experience without manual configuration.

**Acceptance Criteria:**
- ProfileContext provides age-based personalization across the app
- Themes, sounds, and UI complexity adjust based on age ranges (5-8, 9-12)
- Personalization applies consistently to tasks, quizzes, and rewards
- Parents can review and override age-based settings if needed

### Story 5.4: Security & RBAC Enforcement

As a parent concerned about data privacy,
I want robust security with RBAC ensuring parents only see their kids' data,
So that family privacy is protected and cross-profile data access is strictly controlled.

**Acceptance Criteria:**
- RBAC checks in all API routes for cross-profile data access
- Parents can only view and manage their own children's data
- Secure image uploads and storage for proof photos
- Authentication and authorization consistently enforced

### Story 5.5: Performance Optimization & Reliability

As a user expecting smooth app performance,
I want fast load times, reliable sync, and high uptime,
So that the app feels responsive and dependable for daily family use.

**Acceptance Criteria:**
- Page loads <2s (Core Web Vitals, NFR4)
- Photo proofs load <2s for parents (95% success rate, NFR1)
- Timers sync with no drift >5s (NFR2)
- Quiz components maintain 95% uptime (NFR11)
- 100% test coverage for new features via Vitest (NFR8)
- Performance monitoring and analytics tracking implemented