---
name: warn-debug-code
enabled: true
event: file
pattern: console\.log\(|debugger|console\.debug\(|console\.trace\(
action: warn
---

📝 **Debug Code Detected**

You're adding debug statements to the code:
- `console.log()` / `console.debug()` / `console.trace()`
- `debugger` statements

**Reminders:**
- Remove before committing to production
- Consider using a proper logging library for persistent logs
- Debug logs can expose sensitive data

This is just a warning - the edit will proceed.
