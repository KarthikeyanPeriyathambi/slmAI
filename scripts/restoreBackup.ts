import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function restoreLatestBackup() {
  let connection;
  
  try {
    // First, connect without specifying database to create it
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    };

    // Create connection without specifying database
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL server');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'slm_app';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ??`, [dbName]);
    console.log(`Database '${dbName}' is ready`);

    // Now connect to the specific database
    await connection.end();
    
    const dbConfigWithDatabase = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'slm_app',
      multipleStatements: true // Allow multiple statements
    };

    connection = await mysql.createConnection(dbConfigWithDatabase);
    console.log(`Connected to database '${dbName}'`);

    // Path to your data directory
    const dataDir = path.join(__dirname, '..', 'data', 'OCT');
    
    // Get all backup directories
    const backupDirs = fs.readdirSync(dataDir);
    
    // Sort directories by date (newest first)
    const sortedDirs = backupDirs.sort((a, b) => {
      // Convert directory names to dates for comparison
      const dateA = new Date(a.replace(/-/g, '/').replace(/\./g, ':'));
      const dateB = new Date(b.replace(/-/g, '/').replace(/\./g, ':'));
      return dateB.getTime() - dateA.getTime();
    });
    
    if (sortedDirs.length === 0) {
      console.log('No backup directories found');
      return;
    }
    
    // Get the latest backup directory
    const latestDir = sortedDirs[0];
    const backupPath = path.join(dataDir, latestDir, 'billingbackup.sql');
    
    console.log(`Latest backup found: ${backupPath}`);
    
    // Check if the backup file exists
    if (!fs.existsSync(backupPath)) {
      console.log('Backup file not found');
      return;
    }
    
    // Read the SQL file
    const sqlContent = fs.readFileSync(backupPath, 'utf8');
    
    // Process the SQL content to handle stored procedures and other complex statements
    let cleanSql = sqlContent
      .replace(/-- MySqlBackup\.NET.*\n/, '')
      .replace(/-- Dump Time.*\n/, '')
      .replace(/-- --------------------------------------.*\n/g, '')
      .replace(/\/\*!40101 SET.*\*\/;/g, '')
      .replace(/\/\*!40014 SET.*\*\/;/g, '')
      .replace(/\/\*!40101 SET.*\*\/;/g, '')
      .replace(/\/\*!40111 SET.*\*\/;/g, '')
      .replace(/DELIMITER \$\$/g, '')
      .replace(/DELIMITER \|\|/g, '')
      .replace(/DELIMITER ;/g, '')
      .replace(/\/\//g, '')
      .replace(/\$\$/g, ';')
      .replace(/\|\|/g, ';');
    
    // Split the SQL content into individual statements
    const statements = cleanSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    // Execute each statement individually
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements
      if (statement.trim().length === 0) continue;
      
      try {
        await connection.query(statement);
        successCount++;
        
        // Show progress every 100 statements
        if (i % 100 === 0) {
          console.log(`Progress: ${i}/${statements.length} statements processed`);
        }
      } catch (error: any) {
        errorCount++;
        // Log errors but continue with other statements
        console.error(`Error executing statement ${i + 1}:`, error.message.substring(0, 100) + '...');
      }
    }
    
    console.log(`Database restoration completed!`);
    console.log(`Successful statements: ${successCount}`);
    console.log(`Failed statements: ${errorCount}`);
    
    // Show some information about what was restored
    try {
      const [tablesResult] = await connection.query('SHOW TABLES') as any[];
      console.log(`\nRestored ${tablesResult.length} tables:`);
      
      // Show first few table names
      const tableNames = tablesResult.map((row: any) => Object.values(row)[0]).slice(0, 10);
      console.log(tableNames);
      
      if (tablesResult.length > 10) {
        console.log(`... and ${tablesResult.length - 10} more tables`);
      }
    } catch (error) {
      console.error('Error fetching table information:', error);
    }
    
  } catch (error) {
    console.error('Error restoring database:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

// Run the restore function
restoreLatestBackup();