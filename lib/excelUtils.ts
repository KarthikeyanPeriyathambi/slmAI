import * as XLSX from 'xlsx';

/**
 * Parse Excel/CSV file and return structured data
 */
export async function parseExcelFile(buffer: Buffer): Promise<{
  headers: string[];
  data: any[];
  originalData: any[];
}> {
  try {
    // Parse workbook
    const workbook = XLSX.read(buffer, { 
      type: 'buffer', 
      cellDates: true,
      cellNF: true,
      cellText: true
    });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('No sheets found in the file');
    }

    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with headers
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { 
      defval: null,
      raw: false,
      dateNF: 'yyyy-mm-dd'
    });

    if (jsonData.length === 0) {
      throw new Error('File is empty or has no data rows');
    }

    // Extract and normalize headers
    const headers = Object.keys(jsonData[0]);
    const normalizedHeaders = normalizeHeaders(headers);

    // Map data to normalized headers
    const normalizedData = jsonData.map((row: any) => {
      const normalizedRow: any = {};
      headers.forEach((header, index) => {
        const normalizedKey = normalizedHeaders[index];
        let value = row[header];
        
        // Handle date objects
        if (value instanceof Date) {
          value = value.toISOString().split('T')[0]; // YYYY-MM-DD format
        }
        
        // Handle null/undefined values
        if (value === null || value === undefined) {
          value = null;
        }
        
        normalizedRow[normalizedKey] = value;
      });
      return normalizedRow;
    });

    return {
      headers: normalizedHeaders,
      data: normalizedData,
      originalData: jsonData
    };
  } catch (error: any) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}

/**
 * Normalize column headers for consistent processing
 */
export function normalizeHeaders(headers: string[]): string[] {
  return headers.map(h => 
    h.trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
  );
}

/**
 * Infer data type from value
 */
export function inferDataType(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'number') {
    return 'NUMBER';
  }
  
  if (typeof value === 'string') {
    // Check for date patterns
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return 'DATE';
    }
    if (value.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/)) {
      return 'DATETIME';
    }
    
    // Check for numeric string
    if (value.match(/^-?\d+(\.\d+)?$/)) {
      return 'NUMBER';
    }
    
    if (value.length > 255) {
      return 'TEXT';
    }
    
    return 'VARCHAR';
  }
  
  if (value instanceof Date) {
    return 'DATETIME';
  }
  
  return 'VARCHAR';
}

/**
 * Analyze column data type based on all values
 */
export function analyzeColumnType(data: any[], header: string): string {
  const values = data.map(row => row[header]).filter(v => v !== null && v !== undefined);
  
  if (values.length === 0) {
    return 'VARCHAR(255)';
  }
  
  // Check if all values are numeric
  const allNumeric = values.every(v => typeof v === 'number' || !isNaN(parseFloat(v)));
  if (allNumeric) {
    return 'DECIMAL(15,2)';
  }
  
  // Check if all values are dates
  const allDates = values.every(v => {
    if (v instanceof Date) return true;
    if (typeof v === 'string') {
      return v.match(/^\d{4}-\d{2}-\d{2}/) !== null;
    }
    return false;
  });
  if (allDates) {
    return 'DATE';
  }
  
  // Default to TEXT for long strings, VARCHAR otherwise
  const maxLength = Math.max(...values.map(v => String(v).length));
  return maxLength > 255 ? 'TEXT' : 'VARCHAR(255)';
}

/**
 * Generate CREATE TABLE SQL query
 */
export function generateCreateTableSQL(
  tableName: string,
  data: any[],
  headers: string[]
): string {
  const columns = headers.map(header => {
    const dataType = analyzeColumnType(data, header);
    return `\`${header}\` ${dataType}`;
  }).join(',\n');

  const fullColumns = `
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    ${columns},
    \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  `;

  return `CREATE TABLE IF NOT EXISTS \`${tableName}\` (${fullColumns})`;
}

/**
 * Detect duplicate records
 */
export function detectDuplicates(data: any[], keyFields: string[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  
  for (const row of data) {
    const key = keyFields.map(field => row[field]).join('|');
    if (seen.has(key)) {
      duplicates++;
    } else {
      seen.add(key);
    }
  }
  
  return duplicates;
}

/**
 * Validate file structure
 */
export function validateFileStructure(headers: string[], data: any[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for empty headers
  const emptyHeaders = headers.filter(h => !h || h.trim() === '');
  if (emptyHeaders.length > 0) {
    errors.push(`Found ${emptyHeaders.length} empty column header(s)`);
  }
  
  // Check for duplicate headers
  const headerCounts = new Map<string, number>();
  headers.forEach(h => {
    headerCounts.set(h, (headerCounts.get(h) || 0) + 1);
  });
  
  const duplicateHeaders = Array.from(headerCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([header]) => header);
  
  if (duplicateHeaders.length > 0) {
    errors.push(`Duplicate column headers: ${duplicateHeaders.join(', ')}`);
  }
  
  // Check for completely empty rows
  const emptyRows = data.filter(row => 
    Object.values(row).every(v => v === null || v === undefined || v === '')
  ).length;
  
  if (emptyRows > 0) {
    warnings.push(`Found ${emptyRows} completely empty row(s)`);
  }
  
  // Check for rows with inconsistent columns
  const expectedColumns = headers.length;
  const inconsistentRows = data.filter(row => 
    Object.keys(row).length !== expectedColumns
  ).length;
  
  if (inconsistentRows > 0) {
    warnings.push(`Found ${inconsistentRows} row(s) with inconsistent column count`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Format data for display
 */
export function formatDataForDisplay(data: any[], limit: number = 10): string {
  if (data.length === 0) {
    return 'No data available';
  }
  
  const headers = Object.keys(data[0]);
  const truncatedData = data.slice(0, limit);
  
  // Create simple table format
  const headerRow = headers.join(' | ');
  const separator = headers.map(() => '---').join(' | ');
  const dataRows = truncatedData.map(row => 
    headers.map(h => String(row[h] ?? 'null')).join(' | ')
  );
  
  return [headerRow, separator, ...dataRows].join('\n');
}
