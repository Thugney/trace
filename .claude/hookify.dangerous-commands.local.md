---
name: warn-dangerous-commands
enabled: true
event: bash
pattern: rm\s+-rf|chmod\s+777|sudo\s+|dd\s+if=|mkfs
action: block
---

⚠️ **Dangerous Command Detected**

This command could cause significant damage if run incorrectly:
- `rm -rf` - Permanently deletes files/directories
- `chmod 777` - Opens files to all users (security risk)
- `sudo` - Runs with elevated privileges
- `dd if=` - Low-level disk operations
- `mkfs` - Formats filesystems

**Please verify:**
- [ ] The path/target is correct
- [ ] You understand what this command will do
- [ ] You have backups if needed

Approve to proceed, or cancel to abort.
