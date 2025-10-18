import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Setup for E2E tests
const testDbPath = path.join(process.cwd(), 'test-e2e.db');

// Remove existing test database
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
  console.log('🗑️  Removed old test database');
}

process.env.DATABASE_URL = 'file:./test-e2e.db';
process.env.JWT_SECRET = 'test-secret-key-for-e2e-12345678';
process.env.JWT_EXPIRATION = '24h';
process.env.NODE_ENV = 'test';

// Create database schema
console.log('📦 Creating database schema...');
try {
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('✅ Database schema created successfully');
} catch (error) {
  console.error('❌ Failed to create database schema:', error);
  throw error;
}

