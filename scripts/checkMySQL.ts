import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

async function checkMySQL() {
  try {
    // Check if MySQL is installed and accessible
    const { stdout, stderr } = await execPromise('mysql --version');
    
    if (stderr) {
      console.log('MySQL check error:', stderr);
      return false;
    }
    
    console.log('MySQL is installed:', stdout.trim());
    return true;
  } catch (error) {
    console.log('MySQL is not installed or not in PATH');
    console.log('Please install MySQL Server and ensure it is running.');
    console.log('Download from: https://dev.mysql.com/downloads/mysql/');
    return false;
  }
}

async function checkMySQLService() {
  try {
    // On Windows, check if MySQL service is running
    const { stdout, stderr } = await execPromise('sc query MySQL80');
    
    if (stderr) {
      console.log('Service check error:', stderr);
      return false;
    }
    
    if (stdout.includes('RUNNING')) {
      console.log('MySQL service is running');
      return true;
    } else {
      console.log('MySQL service is not running');
      console.log('Please start the MySQL service');
      return false;
    }
  } catch (error) {
    console.log('Could not check MySQL service status');
    return false;
  }
}

async function main() {
  console.log('Checking MySQL installation...\n');
  
  const isInstalled = await checkMySQL();
  if (!isInstalled) {
    return;
  }
  
  console.log('\nChecking MySQL service...\n');
  await checkMySQLService();
  
  console.log('\nNext steps:');
  console.log('1. Update the .env file with your MySQL credentials');
  console.log('2. Run: pnpm db:init');
  console.log('3. Run: pnpm db:restore');
}

main();