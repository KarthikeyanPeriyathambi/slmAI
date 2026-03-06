import { NextRequest } from "next/server";

// Cloud AI helper — calls OpenRouter with fallback models (works on Vercel)
const FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-4-maverick:free',
  'qwen/qwen3-coder-480b-a35b:free',
  'nvidia/nemotron-nano-9b-v2:free',
];

async function callAI(messages: { role: string; content: string }[], temperature = 0.1): Promise<string> {
  const apiKey = process.env.SLM_API_KEY;
  const apiUrl = process.env.SLM_API_URL || 'https://openrouter.ai/api/v1/chat/completions';

  if (!apiKey) throw new Error('SLM_API_KEY is not set in environment variables');

  let lastError: Error | null = null;

  for (const model of FREE_MODELS) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://slm-app.vercel.app',
          'X-Title': 'SLM App',
        },
        body: JSON.stringify({ model, messages, temperature }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 404 || res.status === 503) {
          console.warn(`Model ${model} unavailable, trying next...`);
          lastError = new Error(`OpenRouter API error ${res.status}: ${errText}`);
          continue;
        }
        throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      if (content) return content;
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} failed:`, err.message);
    }
  }

  throw lastError ?? new Error('All AI models failed to respond');
}

// In-memory storage for uploaded Excel data (in production, use Redis or similar)
let uploadedExcelData: {
  fileName: string;
  headers: string[];
  data: any[];
  timestamp: Date;
} | null = null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, fileData } = body;

    console.log('📩 Excel Query API called');
    console.log('Question:', question);
    console.log('File data rows received:', fileData?.length || 0);

    // Validate input
    if (!question || typeof question !== 'string') {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // If fileData is provided, update the stored data
    if (fileData && Array.isArray(fileData)) {
      const allHeaders = new Set<string>();
      fileData.forEach((row: any) => {
        if (row) {
          Object.keys(row).forEach(k => allHeaders.add(k));
        }
      });

      uploadedExcelData = {
        fileName: 'multiple_files',
        headers: Array.from(allHeaders),
        data: fileData,
        timestamp: new Date()
      };
    }

    // Check if we have data to query
    if (!uploadedExcelData || uploadedExcelData.data.length === 0) {
      return new Response(
        JSON.stringify({
          response: "No data available. Please upload an Excel file first.",
          needsUpload: true
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Processing question:", question);
    console.log("Available data:", uploadedExcelData.data.length, "rows");
    console.log("Headers:", uploadedExcelData.headers);

    // Analyze and answer the question
    const answer = await analyzeExcelQuestion(question, uploadedExcelData);

    return new Response(
      JSON.stringify({
        response: answer.response,
        data: answer.data,
        type: answer.type,
        headers: answer.headers
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("💥 Excel Query API Error:", error);
    return new Response(
      JSON.stringify({
        response: `⚠️ **Analysis Failure:** I encountered an unexpected error while processing your request. Please try again or re-upload the file if the issue persists.`,
        error: error.message
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Intelligent Excel data analysis
async function analyzeExcelQuestion(question: string, fileData: { fileName: string; headers: string[]; data: any[] }) {
  const lowerQuestion = question.toLowerCase().trim();
  const data = fileData.data;
  const headers = fileData.headers;

  // Clear data storage after 1 hour of inactivity
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (uploadedExcelData && uploadedExcelData.timestamp < oneHourAgo) {
    uploadedExcelData = null;
    return {
      response: "Session expired. Please upload the file again.",
      type: 'error',
      data: null,
      headers: []
    };
  }

  // Detect specific file mention in the combined dataset
  let targetData = data;
  let targetFiles: string[] = [];

  if (fileData.fileName === 'multiple_files') {
    // Collect all unique source files
    const allSources = new Set<string>();
    data.forEach(row => {
      if (row.source_file) {
        allSources.add(row.source_file.toLowerCase());
      }
    });

    // Check if question mentions any source file
    Array.from(allSources).forEach(source => {
      const cleanSource = source.replace(/\.xlsx|\.csv|\.xls/g, '').toLowerCase().trim();
      if (lowerQuestion.includes(cleanSource) || lowerQuestion.includes(source)) {
        targetFiles.push(source);
      }
    });

    if (targetFiles.length > 0) {
      targetData = data.filter(row => {
        const rowSource = row.source_file?.toLowerCase() || '';
        return targetFiles.some(tf => rowSource === tf);
      });
    }
  }

  // Identify complex queries that should be handled by AI rather than simple static pattern matching
  // This explicitly catches detailed user questions with conditions like "associated with", "involving", etc.
  const isComplexQuery = lowerQuestion.split(' ').length > 6 ||
    /where|associated with|involving|involved|who|which|that have|grouped by|per|each|only|greater than|less than|more than|filter by|rank|show me the/i.test(lowerQuestion);

  if (isComplexQuery) {
    console.log("Complex query detected, skipping basic patterns and relying on AI...");
    return await askAIAboutExcel(question, {
      fileName: targetFiles.length > 0 ? targetFiles.join(', ') : 'multiple_files',
      headers,
      data: targetData
    });
  }

  // 1. TOTAL COUNT & BREAKDOWN QUERIES
  if (lowerQuestion.match(/total|count|how many|how much|number of|records|breakdown|distribution|group by/)) {
    const count = targetData.length;

    // Check for grouping/breakdown request
    const groupingColumn = headers.find(h => {
      const cleanH = h.toLowerCase().replace(/_/g, ' ');
      return lowerQuestion.includes(cleanH) && cleanH.length > 3;
    });

    if (groupingColumn && (lowerQuestion.includes('breakdown') || lowerQuestion.includes('count') || lowerQuestion.includes('group by') || lowerQuestion.includes('distribution'))) {
      const counts: Record<string, number> = {};
      targetData.forEach(row => {
        const val = String(row[groupingColumn] || 'Unknown');
        counts[val] = (counts[val] || 0) + 1;
      });

      const breakdown = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([val, count]) => `| ${val} | ${count} |`)
        .join('\n');

      return {
        response: `### ${groupingColumn.replace(/_/g, ' ')} Breakdown\n\n| ${groupingColumn.replace(/_/g, ' ')} | Count |\n| :--- | :--- |\n${breakdown}\n\n**Total Records:** ${count}`,
        type: 'table',
        data: Object.entries(counts).map(([name, value]) => ({ [groupingColumn]: name, count: value })),
        headers: [groupingColumn, 'count']
      };
    }

    // Check if counting specific filtered items
    const filterResult = applyFilter(targetData, headers, lowerQuestion);
    if (filterResult.filtered) {
      let msg = `Found **${filterResult.count}** record(s) matching your search for "${filterResult.matchValue}"`;
      if (filterResult.matchColumn) {
        msg = `Found **${filterResult.count}** record(s) where **${filterResult.matchColumn.replace(/_/g, ' ')}** is **${filterResult.matchValue}**`;
      }

      if (targetFiles.length > 0) {
        msg += ` in ${targetFiles.join(', ')}`;
      }

      // If they asked for a list or show, return the data, not just the count
      if (lowerQuestion.includes('list') || lowerQuestion.includes('show') || lowerQuestion.includes('details')) {
        return {
          response: msg + ':',
          type: 'table',
          data: filterResult.sample,
          headers
        };
      }

      return {
        response: msg + '.',
        type: 'count',
        data: null,
        headers: []
      };
    }


    let msg = `Found a total of **${count}** record(s)`;
    if (targetFiles.length > 0) {
      msg += ` in ${targetFiles.join(', ')}`;
    }

    return {
      response: msg + `. The headers are: ${headers.join(', ')}.`,
      type: 'count',
      data: null,
      headers: []
    };
  }


  // 2. MAXIMUM/MINIMUM QUERIES
  if (lowerQuestion.match(/maximum|max|highest|largest|top/)) {
    const numericColumn = findNumericColumn(headers, lowerQuestion);
    if (numericColumn) {
      const maxRow = targetData.reduce((max, row) => {
        const value = parseFloat(row[numericColumn]) || 0;
        const maxValue = parseFloat(max[numericColumn]) || 0;
        return value > maxValue ? row : max;
      }, targetData[0]);

      return {
        response: `The maximum ${numericColumn.replace(/_/g, ' ')} is **${maxRow[numericColumn]}** (${JSON.stringify(getRecordSummary(maxRow, headers))}).`,
        type: 'data',
        data: [maxRow],
        headers
      };
    }
  }

  if (lowerQuestion.match(/minimum|min|lowest|smallest|bottom/)) {
    const numericColumn = findNumericColumn(headers, lowerQuestion);
    if (numericColumn) {
      const minRow = targetData.reduce((min, row) => {
        const value = parseFloat(row[numericColumn]) || 0;
        const minValue = parseFloat(min[numericColumn]) || 0;
        return value < minValue ? row : min;
      }, targetData[0]);

      return {
        response: `The minimum ${numericColumn.replace(/_/g, ' ')} is **${minRow[numericColumn]}** (${JSON.stringify(getRecordSummary(minRow, headers))}).`,
        type: 'data',
        data: [minRow],
        headers
      };
    }
  }

  // 3. SUMMATION QUERIES
  if (lowerQuestion.match(/sum|total|add up|summation/)) {
    const numericColumn = findNumericColumn(headers, lowerQuestion);
    if (numericColumn) {
      const sum = targetData.reduce((acc, row) => acc + (parseFloat(row[numericColumn]) || 0), 0);
      return {
        response: `The total sum of ${numericColumn.replace(/_/g, ' ')} is **${sum.toFixed(2)}**.`,
        type: 'summary',
        data: { sum, column: numericColumn },
        headers
      };
    }
  }

  // 4. AVERAGE QUERIES
  if (lowerQuestion.match(/average|avg|mean/)) {
    const numericColumn = findNumericColumn(headers, lowerQuestion);
    if (numericColumn) {
      const avg = targetData.reduce((acc, row) => acc + (parseFloat(row[numericColumn]) || 0), 0) / targetData.length;
      return {
        response: `The average ${numericColumn.replace(/_/g, ' ')} is **${avg.toFixed(2)}**.`,
        type: 'summary',
        data: { average: avg, column: numericColumn },
        headers
      };
    }
  }

  // 5. FILTERING BY YEAR
  const yearMatch = lowerQuestion.match(/\b(20\d{2}|19\d{2})\b/);
  if (yearMatch) {
    const year = yearMatch[0];
    const dateColumn = findDateColumn(headers);

    if (dateColumn) {
      const filtered = targetData.filter(row => {
        const dateValue = row[dateColumn];
        if (!dateValue) return false;
        const dateStr = dateValue.toString();
        return dateStr.includes(year);
      });

      return {
        response: `Found **${filtered.length}** record(s) from the year ${year}.`,
        type: 'data',
        data: filtered.slice(0, 10),
        headers
      };
    }
  }

  // 6. FILTERING BY STATE/LOCATION
  if (lowerQuestion.match(/state|location|city|region|area/)) {
    const locationColumn = findLocationColumn(headers);
    if (locationColumn) {
      // Extract location name from question
      const locations = ['california', 'new york', 'texas', 'florida', 'illinois', 'ohio', 'georgia', 'pennsylvania'];
      const foundLocation = locations.find(loc => lowerQuestion.includes(loc));

      if (foundLocation) {
        const filtered = targetData.filter(row =>
          row[locationColumn]?.toString().toLowerCase().includes(foundLocation)
        );

        return {
          response: `Found **${filtered.length}** record(s) in ${foundLocation.charAt(0).toUpperCase() + foundLocation.slice(1)}.`,
          type: 'data',
          data: filtered.slice(0, 10),
          headers
        };
      }
    }
  }

  // 7. SHOW ALL DATA - Check this BEFORE column-specific queries
  if (
    lowerQuestion.match(/show all|display all|list all|everything|show entire|all data|all records/) ||
    lowerQuestion === 'data' ||
    lowerQuestion.trim() === 'list all' ||
    lowerQuestion.trim() === 'show all' ||
    lowerQuestion.trim() === 'list'
  ) {
    return {
      response: `Displaying all **${targetData.length}** record(s):`,
      type: 'data',
      data: targetData,
      headers
    };
  }

  // 8. SAMPLE/DISPLAY FIRST FEW RECORDS
  if (lowerQuestion.match(/sample|preview|first\s*\d+|show\s*\d+|show me|display|show first|first few/)) {
    const numMatch = lowerQuestion.match(/(first|show)\s*(\d+)/);
    const limit = numMatch ? parseInt(numMatch[2]) : 10;

    return {
      response: `Here are the first **${Math.min(limit, targetData.length)}** record(s):`,
      type: 'data',
      data: targetData.slice(0, Math.min(limit, targetData.length)),
      headers
    };
  }

  // 9. COLUMN-SPECIFIC QUERIES - More specific patterns only
  const columnPattern = lowerQuestion.match(/show\s+(?:the\s+)?(?:all\s+)?(\w+(?:\s+\w+)*)|(?:what\s+are\s+the\s+)(\w+(?:\s+\w+)*)/i);
  if (columnPattern) {
    const requestedColumn = (columnPattern[1] || columnPattern[2]).toLowerCase().replace(/\s+/g, '_');
    const matchingColumn = headers.find(h => h.toLowerCase().includes(requestedColumn));

    if (matchingColumn && !lowerQuestion.includes('all')) { // Avoid catching "list all"
      const values = targetData.map(row => row[matchingColumn]).filter(v => v !== null && v !== undefined);
      const uniqueValues = [...new Set(values)].slice(0, 20);

      return {
        response: `Here are the ${matchingColumn.replace(/_/g, ' ')} values (showing ${uniqueValues.length} unique out of ${values.length} total):`,
        type: 'list',
        data: uniqueValues,
        headers: [matchingColumn]
      };
    }
  }

  // 10. KEYWORD SEARCH - Move to end as fallback
  const searchMatch = lowerQuestion.match(/search|find|looking for|contains?/);
  if (searchMatch) {
    // Extract keyword from question
    const keywords = lowerQuestion
      .replace(/search|find|looking for|show|list|get|which|that|contain/g, '')
      .trim()
      .split(' ')
      .filter(k => k.length > 2);

    if (keywords.length > 0) {
      const filtered = targetData.filter(row => {
        return Object.values(row).some(value => {
          const strValue = value?.toString().toLowerCase() || '';
          return keywords.some(keyword => strValue.includes(keyword));
        });
      });

      return {
        response: `Found **${filtered.length}** record(s) containing "${keywords.join(' ')}".`,
        type: 'data',
        data: filtered.slice(0, 10),
        headers
      };
    }
  }

  // FALLBACK: Use AI for complex analysis if local patterns didn't match perfectly
  console.log("No local patterns found, falling back to AI analysis");
  return await askAIAboutExcel(question, fileData);
}

// AI-powered Excel analysis
async function askAIAboutExcel(question: string, fileData: { fileName: string; headers: string[]; data: any[] }) {
  // Provide a summary of the data for the AI
  const headers = fileData.headers;
  const totalRows = fileData.data.length;

  // The free tier of AI APIs has strict token limits (e.g. 37k tokens).
  // Wide Excel files (e.g. 80 columns) generate massive JSON strings very quickly.
  // Instead of a hard row limit, we dynamically slice the data to keep the stringified 
  // version under 60,000 characters (approx ~15k tokens) to ensure it stays well under limits.
  const dataSample: any[] = [];
  let currentLength = 0;
  for (const row of fileData.data) {
    const rowStringLength = JSON.stringify(row).length;
    // Cap at roughly 60,000 characters
    if (currentLength + rowStringLength > 60000 && dataSample.length > 0) {
      break;
    }
    dataSample.push(row);
    currentLength += rowStringLength;
  }
  const sourceFiles = [...new Set(fileData.data.map(row => row.source_file).filter(Boolean))];

  // Pre-calculate distributions for columns with limited unique values
  // This allows the AI to give accurate overall counts even from a data sample
  const fullDataBreakdowns: any = {};
  headers.forEach(h => {
    const values = fileData.data.map(r => String(r[h] || 'Unknown'));
    const uniqueValues = new Set(values);
    if (uniqueValues.size > 1 && uniqueValues.size <= 30) {
      const counts: Record<string, number> = {};
      values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      fullDataBreakdowns[h] = counts;
    }
  });

  const prompt = `
    You are an expert Data Analyst assistant. I have ${sourceFiles.length > 1 ? sourceFiles.length + ' files' : 'a file'} uploaded.
    
    FILE LIST:
    ${sourceFiles.length > 0 ? sourceFiles.map(f => `- ${f}`).join('\n') : fileData.fileName}

    STATISTICS:
    - Total Columns: ${headers.length}
    - Total Combined Rows: ${totalRows}
    - Headers: ${headers.join(", ")}

    FULL DATA BREAKDOWNS (Exact counts for the entire ${totalRows} rows):
    ${JSON.stringify(fullDataBreakdowns, null, 2)}
    
    DATA SAMPLE (first ${dataSample.length} rows for additional context):
    ${JSON.stringify(dataSample, null, 2)}
    
    USER QUESTION: "${question}"
    
    INSTRUCTIONS:
    1. IMPORTANT: Use the 'FULL DATA BREAKDOWNS' above to provide accurate counts/summaries for the ENTIRE dataset of ${totalRows} rows.
    2. If the user asks for a specific name, entity, or value (e.g. "Iswarya"), search for it across all columns in the 'DATA SAMPLE' and distributions.
    3. Respond with a clear count or list. Format your answer in professional markdown. If many columns exist, only show the most relevant ones.
    4. Do NOT say you are analyzing a sample if you can find the specific answer in the provided context.
    5. Each row has a 'source_file' column; use it if relevant.
    
    RESPONSE:
  `;



  try {
    const aiText = await callAI([{ role: "user", content: prompt }], 0.1);

    return {
      response: aiText || "I processed your data but couldn't generate a verbal response.",
      type: 'text',
      data: null,
      headers: []
    };
  } catch (error: any) {
    console.error("AI Analysis error:", error);
    return {
      response: "System Error while reaching AI service: " + (error.message || String(error)),
      type: 'error',
      data: null,
      headers: []
    };
  }
}

// Helper functions

function applyFilter(data: any[], headers: string[], question: string) {
  const lowerQ = question.toLowerCase();
  let filtered = data;
  let matchColumn = '';
  let matchValue = '';

  // 1. Time-based filters (existing)
  if (lowerQ.includes('this year') || lowerQ.includes('current year')) {
    const currentYear = new Date().getFullYear().toString();
    const dateColumn = findDateColumn(headers);
    if (dateColumn) {
      filtered = data.filter(row => row[dateColumn]?.toString().includes(currentYear));
      return { filtered: true, count: filtered.length, sample: filtered, headers, matchColumn: dateColumn, matchValue: currentYear };
    }
  }

  // 2. Dynamic Value Filtering
  // We look for words in the question that match values in the data
  const ignoreWords = ['show', 'list', 'how', 'many', 'count', 'the', 'was', 'did', 'sold', 'bought', 'total', 'is', 'are', 'was', 'were', 'for', 'with', 'in', 'of', 'client', 'name', 'executive', 'sales'];
  const words = lowerQ.split(/\s+/).filter(w => w.length > 2 && !ignoreWords.includes(w));

  // Limit search to first 1000 rows for performance
  const searchSample = data.slice(0, 1000);

  for (const word of words) {
    for (const header of headers) {
      // Check if this word exists in this column
      const match = searchSample.find(row => {
        const val = String(row[header] || '').toLowerCase();
        return val === word || (val.includes(word) && val.length < 20); // allow partial but not too vague
      });

      if (match) {
        const actualValue = String(match[header]);
        const exactMatch = data.filter(row => String(row[header] || '').toLowerCase() === actualValue.toLowerCase());

        // If we found a significant filter, return it
        if (exactMatch.length > 0 && exactMatch.length < data.length) {
          return {
            filtered: true,
            count: exactMatch.length,
            sample: exactMatch,
            headers,
            matchColumn: header,
            matchValue: actualValue
          };
        }
      }
    }
  }

  return { filtered: false, count: data.length, sample: data.slice(0, 10), headers };
}


function findNumericColumn(headers: string[], question: string): string | null {
  const numericKeywords = ['price', 'amount', 'cost', 'quantity', 'value', 'sales', 'revenue', 'total', 'mrp', 'rate'];

  for (const keyword of numericKeywords) {
    const match = headers.find(h => h.toLowerCase().includes(keyword));
    if (match) return match;
  }

  // Fallback: find first numeric-looking column
  return headers.find(h => !isNaN(parseFloat(String(findSampleValue(h))))) || null;
}

function findDateColumn(headers: string[]): string | null {
  const dateKeywords = ['date', 'time', 'created', 'updated', 'year', 'month', 'day'];

  for (const keyword of dateKeywords) {
    const match = headers.find(h => h.toLowerCase().includes(keyword));
    if (match) return match;
  }

  return null;
}

function findLocationColumn(headers: string[]): string | null {
  const locationKeywords = ['state', 'city', 'location', 'region', 'address', 'country'];

  for (const keyword of locationKeywords) {
    const match = headers.find(h => h.toLowerCase().includes(keyword));
    if (match) return match;
  }

  return null;
}

function findSampleValue(header: string): any {
  if (uploadedExcelData && uploadedExcelData.data.length > 0) {
    return uploadedExcelData.data[0][header];
  }
  return null;
}

function getRecordSummary(row: any, headers: string[]): any {
  const summary: any = {};
  const importantHeaders = headers.filter(h =>
    h.includes('name') || h.includes('id') || h.includes('type') || h.includes('category')
  ).slice(0, 3);

  importantHeaders.forEach(h => {
    summary[h] = row[h];
  });

  return summary;
}
