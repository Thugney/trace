# Admin Controls Documentation

This document describes the admin controls available in the Family Learning Hub application.

## Parent Profile Creation Controls

### Overview

Administrators can control whether parents are allowed to create co-parent accounts in their families. This feature prevents unauthorized additions to families and provides audit logging for security tracking.

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `allow_parent_creation` | `true` | When enabled, parents can add co-parents to their family |
| `max_parents_per_family` | `4` | Maximum number of parent accounts allowed per family (1-10) |

### How It Works

1. **When Enabled (`allow_parent_creation: true`)**
   - Parents can use the "Add Co-Parent" feature in Family Settings
   - Parents can create other parent profiles via the profiles API
   - The `max_parents_per_family` limit still applies

2. **When Disabled (`allow_parent_creation: false`)**
   - Parents receive error: "Parent/co-parent creation has been disabled by the administrator"
   - Only administrators can create new parent profiles
   - Existing parents are not affected

3. **Max Parents Limit**
   - When the limit is reached, parents receive error: "Maximum number of parents (X) reached for this family. Contact admin to increase the limit."
   - Administrators can adjust the limit from 1 to 10

### API Endpoints

#### Get Parent Creation Settings (Admin Only)
```
GET /api/settings/admin/parent-creation
```

**Response:**
```json
{
  "allow_parent_creation": true,
  "max_parents_per_family": 4
}
```

#### Update Parent Creation Settings (Admin Only)
```
PUT /api/settings/admin/parent-creation
```

**Request Body:**
```json
{
  "allow_parent_creation": false,
  "max_parents_per_family": 6
}
```

**Response:**
```json
{
  "success": true,
  "message": "Parent creation settings updated",
  "allow_parent_creation": false,
  "max_parents_per_family": 6
}
```

### Audit Logging

All parent profile creations are logged to the `audit_logs` table for security tracking.

#### Logged Actions

| Action | Description |
|--------|-------------|
| `PARENT_CREATED` | A parent profile was created via `/api/profiles` |
| `COPARENT_CREATED` | A co-parent was added via `/api/families/my-family/add-adult` |
| `PARENT_CREATION_SETTINGS_CHANGED` | An admin changed the parent creation settings |

#### Audit Log Entry Structure

```json
{
  "id": 1,
  "action": "COPARENT_CREATED",
  "entity_type": "profile",
  "entity_id": 42,
  "actor_id": 5,
  "actor_type": "parent",
  "actor_name": "John Doe",
  "details": {
    "created_parent_name": "Jane Doe",
    "created_parent_username": "janedoe",
    "family_id": 3,
    "created_by_name": "John Doe",
    "linked_children_count": 2
  },
  "created_at": "2026-01-21T10:30:00.000Z"
}
```

#### View Audit Logs (Admin Only)

**All Audit Logs:**
```
GET /api/settings/admin/audit-logs?action=PARENT_CREATED&limit=50&offset=0
```

**Parent Creation Logs Only:**
```
GET /api/settings/admin/audit-logs/parent-creation
```

### Frontend UI

Administrators can manage parent creation controls in **Settings > Security**:

1. **Toggle Switch**: Enable/disable parent creation
2. **Slider**: Set maximum parents per family (1-10)
3. **View Audit Logs**: Button to view parent creation history

### Database Schema

#### Settings Table
```sql
-- Settings used:
-- allow_parent_creation: 'true' | 'false'
-- max_parents_per_family: '1' to '10' (stored as string)
```

#### Audit Logs Table (New Columns)
```sql
ALTER TABLE audit_logs ADD COLUMN action TEXT;
ALTER TABLE audit_logs ADD COLUMN entity_type TEXT;
ALTER TABLE audit_logs ADD COLUMN entity_id INTEGER;
ALTER TABLE audit_logs ADD COLUMN actor_id INTEGER;
ALTER TABLE audit_logs ADD COLUMN actor_type TEXT;
ALTER TABLE audit_logs ADD COLUMN details TEXT;
```

### Security Considerations

1. **Username Uniqueness**: All profile creation endpoints now validate username uniqueness to prevent duplicate accounts

2. **Auto-Linking**: When a co-parent is created, they are automatically linked to all existing children in the family via the `guardian_students` table. This should be considered when disabling parent creation, as it affects who has access to children's data.

3. **Audit Trail**: All parent creations are logged with full details for accountability

4. **Admin Override**: Administrators can always create parent profiles regardless of the `allow_parent_creation` setting

### Migration

For existing databases, the following migrations run automatically:

1. New settings are added if they don't exist:
   - `allow_parent_creation` = `'true'`
   - `max_parents_per_family` = `'4'`

2. New columns are added to `audit_logs` table if they don't exist

### Troubleshooting

**"Parent/co-parent creation has been disabled by the administrator"**
- An admin has disabled parent creation
- Contact the admin to either enable it or create the profile manually

**"Maximum number of parents (X) reached for this family"**
- The family has reached its parent limit
- Contact an admin to increase the `max_parents_per_family` setting

**"Username already exists"**
- The chosen username is already in use
- Choose a different username
