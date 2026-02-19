# 🚀 Setup and Troubleshooting Guide

## 🔧 Initial Setup (IMPORTANT - Run This First!)

The changes you pulled require the **backend to restart** so database migrations can run. Follow these steps:

### Step 1: Rebuild Docker Containers

```bash
cd /home/user/trace

# Stop existing containers
sudo docker-compose down

# Rebuild with no cache (important!)
sudo docker-compose build --no-cache

# Start containers
sudo docker-compose up -d

# Check they're running
sudo docker-compose ps
```

### Step 2: Verify Database Migrations

Check backend logs to confirm migrations ran:

```bash
sudo docker logs family-pwa-backend | grep "monthly_goals"
```

**You should see:**
```
🔄 Migrating monthly_goals table: adding parent approval columns...
✅ Added parent_approved column
✅ Added created_by column
✅ Added approved_by column
✅ Migration completed
```

### Step 3: Clear Browser Cache

**CRITICAL:** Old frontend code may be cached in your browser.

**Option A - Clear Cache (Recommended):**
- Chrome/Edge: `Ctrl + Shift + Del`
- Check "Cached images and files"
- Click "Clear data"

**Option B - Use Incognito:**
- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`

---

## 📚 How to Use All Features

### 1. 👩‍🏫 Teacher: How to Create Quizzes

**Step-by-Step:**

1. **Login as Teacher** (e.g., Sara)

2. **Navigate to School Dashboard**
   - Click "School" in the navigation menu
   - Or go to `/school` URL

3. **Select a Class**
   - At the top, select the class you teach (e.g., "Sunday School - Beginners")

4. **Click "Create Assignment"** button

5. **Fill in Assignment Form:**
   ```
   Title: "Alphabet Quiz A-D"
   Description: "Test your knowledge of letters A-D"
   Type: Select "Quiz" (IMPORTANT!)
   Due Date: (optional)
   ```

6. **Click "Create Assignment"**
   - The quiz creation form will automatically open!

7. **Add Quiz Questions:**
   - Fill in question text
   - Add at least 2 options (A and B required, C and D optional)
   - Select the correct answer (a, b, c, or d)
   - Click "+ Add Question" to add more
   - Click "Create Quiz" when done

**That's it!** Students can now take the quiz.

---

### 2. 👶 Kids: How to Create Goals

**Step-by-Step:**

1. **Login as a Child** (e.g., Lydia, Samuel)

2. **Navigate to Tasks Page**
   - Click "Tasks" in navigation
   - Or go to `/tasks` URL

3. **Look for "Monthly Goal" Card**
   - It's a green card with a target icon 🎯
   - Shows current month

4. **Click "Set Goal" Button**
   - Small button in the top-right of the green card

5. **Fill in Goal Form:**
   ```
   Goal Description: "Read 10 books"
   Points to Earn: 100
   Reward Type: "kroner" or "ice cream" or "movie"
   ```

6. **Click "Set Goal"**
   - You'll see: ✅ "Goal created! It will appear once your parent approves it."
   - The goal WON'T show in your dashboard yet (this is normal!)

7. **Parent Approval:**
   - Parent logs in
   - Sees yellow "Pending Goal Approvals" card
   - Clicks "✓ Approve"
   - NOW the goal appears in your dashboard!

---

### 3. 👨‍👩‍👧 Parents: How to Approve Goals

**Step-by-Step:**

1. **Login as Parent** (e.g., Helen)

2. **Navigate to Tasks Page**

3. **Look for Yellow Card**
   - "Pending Goal Approvals" card at the top
   - Shows all pending goals from your children

4. **Review Each Goal:**
   - See which child created it
   - Read the goal description
   - Check points and reward type

5. **Approve or Reject:**
   - Click "✓ Approve" → Goal becomes active for child
   - Click "✗ Reject" → Goal is deleted

---

### 4. 📊 Teacher Dashboard: Viewing Students

**Current Behavior:**
- Teacher dashboard shows **stats** (total students, classes, assignments)
- To see **individual students**, go to **School Dashboard** → **Students Tab**

**How to See All Students:**

1. Login as teacher
2. Go to **School** page
3. Select a class at the top
4. Click **"Students" tab**
5. You'll see:
   - All students in that class
   - Their progress
   - Completed/pending assignments

---

## 🐛 Troubleshooting Common Issues

### Issue 1: "I don't see any changes after pulling"

**Solution:**
```bash
# Rebuild everything
sudo docker-compose down
sudo docker-compose build --no-cache
sudo docker-compose up -d

# Clear browser cache (Ctrl+Shift+Del)
# OR use incognito mode
```

### Issue 2: "Helen (parent) can't log in"

**Possible Causes:**

**A. Wrong username/password:**
- Check what Helen's credentials are
- Default usernames are usually lowercase (e.g., "helen")

**B. Database not initialized:**
```bash
# Check if backend is running
sudo docker-compose ps

# Check backend logs
sudo docker logs family-pwa-backend | tail -50

# Should see "✅ Database initialized successfully"
```

**C. Profile doesn't exist:**
```bash
# Create Helen profile via API or admin panel
# Navigate to admin dashboard to add users
```

### Issue 3: "Kids can't create goals"

**Check These:**

**A. Are they logged in as a child profile?**
- Profile type must be "child" (not "parent")

**B. Is the Tasks page loading?**
```bash
# Check browser console (F12)
# Look for API errors
```

**C. Do they already have an approved goal?**
- The "Set Goal" button only shows when there's NO current approved goal
- This is the designed behavior (one active goal at a time)

**D. Try creating a goal as parent first:**
- Parents can create auto-approved goals
- This tests if the system works

### Issue 4: "Teachers can't create quizzes"

**Common Mistakes:**

**A. Not selecting "Quiz" type:**
- When creating assignment, you MUST select Type = "Quiz"
- Other types (homework, reading) won't show quiz form

**B. Not clicking "Create Assignment" first:**
- You must create the assignment first
- Then the quiz form opens automatically

**C. Wrong page:**
- Must be on `/school` (School Dashboard)
- NOT on `/dashboard` (regular dashboard)

### Issue 5: "Teacher dashboard doesn't show students"

**This is by design:**
- Teacher dashboard shows **stats** only
- To see students: **School Dashboard → Students Tab**

**If you want to add student list to teacher dashboard:**
- We can add this feature (let me know!)

---

## 📝 Testing Checklist

After setup, test these flows:

### ✅ Quiz System
- [ ] Teacher creates quiz assignment
- [ ] Quiz form opens automatically
- [ ] Teacher adds 3+ questions
- [ ] Student can see quiz in assignments
- [ ] Student takes quiz
- [ ] Results saved and visible
- [ ] Parent can see child's results

### ✅ Goal System
- [ ] Kid creates goal
- [ ] Kid sees approval message
- [ ] Goal doesn't show in kid's dashboard yet
- [ ] Parent sees yellow pending approval card
- [ ] Parent approves goal
- [ ] Goal now shows in kid's dashboard
- [ ] Kid can track progress

### ✅ Login System
- [ ] Helen (parent) can log in
- [ ] Kids can log in
- [ ] Teachers can log in
- [ ] All profiles load correctly

---

## 🔍 Diagnostic Commands

If something isn't working, run these:

```bash
# Check containers status
sudo docker-compose ps

# View backend logs (last 50 lines)
sudo docker logs family-pwa-backend | tail -50

# View frontend logs
sudo docker logs family-pwa-frontend | tail -30

# Check database file exists
ls -lh ./data/family.db

# Restart just backend
sudo docker-compose restart backend

# Restart everything
sudo docker-compose restart
```

---

## 📞 Getting Help

If you're still stuck, provide these details:

1. **What are you trying to do?**
   - Create quiz? Create goal? Login?

2. **What profile type?**
   - Teacher? Parent? Kid?

3. **What error do you see?**
   - Browser console errors (F12 → Console tab)
   - Backend logs: `sudo docker logs family-pwa-backend | tail -50`

4. **What have you tried?**
   - Cleared cache? Rebuilt containers? Used incognito?

---

## 🎯 Quick Reference

| Feature | User Type | Where to Find | Button/Action |
|---------|-----------|---------------|---------------|
| Create Quiz | Teacher | School Dashboard | Create Assignment → Type: Quiz |
| Create Goal | Kid | Tasks Page | Set Goal (in green card) |
| Approve Goal | Parent | Tasks Page | Yellow card → ✓ Approve |
| See Students | Teacher | School Dashboard | Students Tab |
| Take Quiz | Student | School Page | Click assignment → Take Quiz |
| View Results | All | School Page | Assignment → View Results |

---

## 🔐 Default Credentials

Check your database or ask admin for:
- Helen's username and password
- Teacher credentials (Sara)
- Kid credentials (Lydia, Samuel, etc.)

Common usernames:
- `helen` (parent)
- `sara` (teacher)
- `lydia`, `samuel` (kids)

---

**Last Updated:** January 2, 2026
**Version:** 1.0 with Parent Approval System
