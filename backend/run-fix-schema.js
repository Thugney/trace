// Script to fix database schema
import { fixProfilesSchema } from './src/database/migrations/fix-profiles-schema.js';
import db from './src/database/init.js';

console.log('🚀 Running database schema fix...');
fixProfilesSchema();
console.log('✅ Schema fix complete');

// Close database connection
db.close();