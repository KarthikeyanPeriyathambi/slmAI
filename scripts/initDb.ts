import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

async function initDatabase() {
  let connection;
  
  try {
    // Database connection configuration (without specifying database)
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    };

    // Create connection
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL server');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'slm_app';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ??`, [dbName]);
    console.log(`Database '${dbName}' is ready`);

    // Use the database
    await connection.query(`USE ??`, [dbName]);
    console.log(`Using database '${dbName}'`);

    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the init function
initDatabase();