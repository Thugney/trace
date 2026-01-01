-- Reset all bcrypt-hashed PINs to plain '1234'
-- Run this if your PINs were hashed by previous code

-- Show current PINs (for reference)
SELECT id, name, type,
  CASE
    WHEN pin LIKE '$2%' THEN 'HASHED: ' || substr(pin, 1, 20) || '...'
    ELSE 'PLAIN: ' || pin
  END as pin_status
FROM profiles
WHERE pin IS NOT NULL;

-- Reset hashed PINs to '1234'
UPDATE profiles
SET pin = '1234'
WHERE pin LIKE '$2%';

-- Show results
SELECT id, name, type, pin
FROM profiles
WHERE pin IS NOT NULL;

-- Summary
SELECT
  COUNT(*) as total_profiles,
  SUM(CASE WHEN pin = '1234' THEN 1 ELSE 0 END) as reset_to_1234,
  SUM(CASE WHEN pin != '1234' AND pin IS NOT NULL THEN 1 ELSE 0 END) as other_pins
FROM profiles;
