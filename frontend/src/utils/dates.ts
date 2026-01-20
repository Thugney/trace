// Date utility functions for handling SQLite timestamps

/**
 * Normalizes a SQLite timestamp to proper ISO format with timezone.
 * SQLite's CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" in UTC
 * without timezone indicator. This function adds the 'Z' suffix
 * so JavaScript's Date parser treats it as UTC.
 */
export function normalizeSqliteTimestamp(timestamp: string): string {
  if (!timestamp) return timestamp;

  // Already has timezone info
  if (timestamp.includes('Z') || timestamp.includes('+') || timestamp.includes('-T')) {
    return timestamp;
  }

  // SQLite format: "YYYY-MM-DD HH:MM:SS" - convert to ISO format with Z
  if (!timestamp.includes('T')) {
    return timestamp.replace(' ', 'T') + 'Z';
  }

  // Has T but no timezone
  return timestamp + 'Z';
}

/**
 * Parses a SQLite timestamp as a proper Date object in UTC.
 */
export function parseSqliteTimestamp(timestamp: string): Date {
  return new Date(normalizeSqliteTimestamp(timestamp));
}

/**
 * Formats a timestamp as "X time ago" string.
 * Properly handles SQLite UTC timestamps.
 */
export function formatTimeAgo(dateString: string): string {
  const date = parseSqliteTimestamp(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
