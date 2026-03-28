import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };

  const dbName = process.env.DB_NAME || 'slm_app';

  try {
    // 1. Connect without database first
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL server.');

    // 2. Create database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database \`${dbName}\` created or already exists.`);

    // 3. Switch to the database
    await connection.query(`USE \`${dbName}\``);

    // 4. Run migration script
    const migrationPath = path.join(process.cwd(), 'scripts', 'migrations.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`🚀 Starting migration: ${statements.length} statements found.`);

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await connection.query(statement);
    }

    console.log('✅ Migration completed successfully.');
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
