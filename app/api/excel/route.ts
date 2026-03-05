import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import pool from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const mode = (formData.get("mode") as string) || "excel";

    if (!file) {
      return jsonResponse({ error: "No file uploaded" }, 400);
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCsv = fileName.endsWith(".csv");

    if (!isExcel && !isCsv) {
      return jsonResponse(
        { error: "Invalid file format. Upload .xlsx, .xls, or .csv only." },
        400
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      raw: false,
    });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return jsonResponse({ error: "No sheets found in file" }, 400);
    }

    const worksheet = workbook.Sheets[sheetName];

    /* --------------------------------------------------
       🔥 SMART HEADER DETECTION (Fixes SRS issue)
    -------------------------------------------------- */

    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    const nonEmptyRows = rawRows.filter((row) =>
      row.some((cell) => cell !== null && cell !== "")
    );

    if (nonEmptyRows.length === 0) {
      return jsonResponse({ error: "File contains no usable data" }, 400);
    }

    // Detect header row (row with max text cells)
    let headerIndex = 0;
    let maxTextCount = 0;

    nonEmptyRows.forEach((row, index) => {
      const textCount = row.filter(
        (cell) => typeof cell === "string" && cell.trim() !== ""
      ).length;

      if (textCount > maxTextCount) {
        maxTextCount = textCount;
        headerIndex = index;
      }
    });

    const rawHeaders = nonEmptyRows[headerIndex];

    const normalizedHeaders = rawHeaders.map((h: any, i: number) => {
      let header = h?.toString().trim();
      if (!header) header = `column_${i + 1}`;

      return header
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w]/g, "");
    });

    // Remove duplicate headers
    const uniqueHeaders = normalizedHeaders.map((header, index) => {
      const count = normalizedHeaders
        .slice(0, index)
        .filter((h) => h === header).length;
      return count > 0 ? `${header}_${count}` : header;
    });

    const dataRows = nonEmptyRows.slice(headerIndex + 1);

    const cleanedData = dataRows
      .map((row) => {
        const obj: any = {};
        uniqueHeaders.forEach((header, colIndex) => {
          let value = row[colIndex] ?? null;

          if (value instanceof Date) {
            value = value.toISOString().split("T")[0];
          }

          obj[header] = value;
        });
        return obj;
      })
      .filter((row) =>
        Object.values(row).some((val) => val !== null && val !== "")
      );

    if (cleanedData.length === 0) {
      return jsonResponse({ error: "No valid data rows found" }, 400);
    }

    console.log(
      `Parsed ${cleanedData.length} rows with columns: ${uniqueHeaders.join(
        ", "
      )}`
    );

    /* --------------------------------------------------
       🗄️ MYSQL MODE
    -------------------------------------------------- */

    if (mode === "mysql") {
      try {
        const connection = await pool.getConnection();
        let tableName = "uploaded_data";

        const [tableExists]: any = await connection.execute(
          `SHOW TABLES LIKE ?`,
          [tableName]
        );

        if (tableExists.length === 0) {
          const createQuery = generateCreateTableQuery(
            tableName,
            cleanedData,
            uniqueHeaders
          );
          await connection.execute(createQuery);
        }

        const insertedCount = await insertDataIntoMySQL(
          connection,
          tableName,
          cleanedData,
          uniqueHeaders
        );

        connection.release();

        return jsonResponse({
          success: true,
          message: `Inserted ${insertedCount} records into ${tableName}`,
          rowCount: cleanedData.length,
          insertedCount,
          tableName,
          headers: uniqueHeaders,
          sampleData: cleanedData.slice(0, 5),
          mode: "mysql",
        });
      } catch (dbError: any) {
        return jsonResponse(
          { error: `Database error: ${dbError.message}` },
          500
        );
      }
    }

    /* --------------------------------------------------
       📊 EXCEL MODE
    -------------------------------------------------- */

    console.log('📊 Excel Mode - Returning ALL data:', cleanedData.length, 'rows');
    
    return jsonResponse({
      success: true,
      message: `Successfully processed ${cleanedData.length} records`,
      rowCount: cleanedData.length,
      headers: uniqueHeaders,
      data: cleanedData, // ALL data for Excel mode
      mode: "excel",
    });
  } catch (error: any) {
    return jsonResponse(
      { error: `Failed to process file: ${error.message}` },
      500
    );
  }
}

/* --------------------------------------------------
   🔧 HELPERS
-------------------------------------------------- */

function jsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function generateCreateTableQuery(
  tableName: string,
  data: any[],
  headers: string[]
) {
  const columns = headers
    .map((header) => {
      let type = "VARCHAR(255)";

      for (const row of data) {
        const value = row[header];
        if (typeof value === "number") {
          type = "DECIMAL(15,2)";
          break;
        }
        if (typeof value === "string" && value.length > 200) {
          type = "TEXT";
          break;
        }
      }

      return `\`${header}\` ${type}`;
    })
    .join(",\n");

  return `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      ${columns},
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function insertDataIntoMySQL(
  connection: any,
  tableName: string,
  data: any[],
  headers: string[]
) {
  let inserted = 0;

  for (const row of data) {
    const keys = headers.join(", ");
    const placeholders = headers.map(() => "?").join(", ");
    const values = headers.map((h) => row[h]);

    await connection.execute(
      `INSERT INTO ${tableName} (${keys}) VALUES (${placeholders})`,
      values
    );

    inserted++;
  }

  return inserted;
}