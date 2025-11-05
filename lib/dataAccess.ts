import pool from './db';

// Generic function to execute a query
export async function executeQuery(query: string, params: any[] = []) {
  const connection = await pool.getConnection();
  try {
    const [results] = await connection.execute(query, params);
    return results;
  } catch (error) {
    console.error(`Error executing query: ${query}`, error);
    throw error;
  } finally {
    connection.release();
  }
}

// Get all tables in the database
export async function getTables() {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE()
  `;
  return await executeQuery(query);
}

// Get table structure
export async function getTableStructure(tableName: string) {
  const query = `
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() AND table_name = ?
    ORDER BY ordinal_position
  `;
  return await executeQuery(query, [tableName]);
}

// Get sample data from a table
export async function getSampleData(tableName: string, limit: number = 10) {
  const query = `SELECT * FROM ?? LIMIT ?`;
  return await executeQuery(query, [tableName, limit]);
}

// Get comprehensive database schema information with additional metadata
export async function getDatabaseSchema() {
  // Get all tables with row counts for better context
  const tablesQuery = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE()
  `;
  const tables: any = await executeQuery(tablesQuery);
  
  // Get structure for each table with additional metadata
  const schemaInfo: any = {};
  for (const table of tables) {
    const tableName = table.TABLE_NAME || table.table_name;
    
    // Get column information
    const structureQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default,
        extra
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ordinal_position
    `;
    const structure: any = await executeQuery(structureQuery, [tableName]);
    
    // Get approximate row count for the table
    let rowCount = 0;
    try {
      const countQuery = `SELECT COUNT(*) as count FROM ??`;
      const countResult: any = await executeQuery(countQuery, [tableName]);
      rowCount = countResult[0]?.count || 0;
    } catch (error) {
      // Ignore count errors
    }
    
    schemaInfo[tableName] = {
      columns: structure,
      rowCount: rowCount
    };
  }
  
  return schemaInfo;
}