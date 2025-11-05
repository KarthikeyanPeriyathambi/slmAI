import fs from 'fs';
import path from 'path';

function analyzeBackupFile() {
  try {
    // Path to your data directory
    const dataDir = path.join(__dirname, '..', 'data', 'OCT');
    
    // Get all backup directories
    const backupDirs = fs.readdirSync(dataDir);
    
    // Sort directories by date (newest first)
    const sortedDirs = backupDirs.sort((a, b) => {
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
    
    console.log(`Analyzing backup file: ${backupPath}`);
    
    // Check if the backup file exists
    if (!fs.existsSync(backupPath)) {
      console.log('Backup file not found');
      return;
    }
    
    // Read the first few lines to understand the structure
    const fileContent = fs.readFileSync(backupPath, 'utf8');
    const lines = fileContent.split('\n').slice(0, 50); // First 50 lines
    
    console.log('\nFirst 50 lines of the backup file:');
    console.log('=====================================');
    lines.forEach((line, index) => {
      console.log(`${index + 1}: ${line}`);
    });
    
    // Look for CREATE TABLE statements
    const createTableMatches = fileContent.match(/CREATE TABLE[^;]+;/g);
    if (createTableMatches) {
      console.log('\nFound CREATE TABLE statements:');
      console.log('==============================');
      createTableMatches.forEach((statement, index) => {
        console.log(`${index + 1}: ${statement.substring(0, 100)}...`);
      });
    } else {
      console.log('\nNo CREATE TABLE statements found in the first part of the file');
    }
    
    // Look for INSERT statements
    const insertMatches = fileContent.match(/INSERT INTO[^;]+;/g);
    if (insertMatches) {
      console.log('\nFound INSERT statements:');
      console.log('========================');
      console.log(`Total INSERT statements: ${insertMatches.length}`);
      console.log('First few INSERT statements:');
      insertMatches.slice(0, 5).forEach((statement, index) => {
        console.log(`${index + 1}: ${statement.substring(0, 100)}...`);
      });
    } else {
      console.log('\nNo INSERT statements found in the first part of the file');
    }
    
    // Get file size
    const stats = fs.statSync(backupPath);
    console.log(`\nFile size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('Error analyzing backup file:', error);
  }
}

// Run the analysis
analyzeBackupFile();