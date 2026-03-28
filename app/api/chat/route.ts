import { NextRequest } from "next/server";
import { executeQuery, getDatabaseSchema } from '@/lib/dataAccess';
import pool from '@/lib/db';
import { callExternalAPI, normalizeAPIResponse } from '@/lib/apiConnector';

// Cloud AI helper — calls OpenRouter with fallback models (works on Vercel)
const FREE_MODELS = [
  "minimax/minimax-m2.5"
  // 'nvidia/nemotron-nano-9b-v2:free',
  // 'qwen/qwen3-coder-480b-a35b:free',
  // 'meta-llama/llama-3.3-70b-instruct:free',
  // 'meta-llama/llama-4-maverick:free',
];

async function callAI(messages: { role: string; content: string }[], temperature = 0.7): Promise<string> {
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
        // Try next model if this one has no endpoints
        if (res.status === 404 || res.status === 503) {
          console.warn(`Model ${model} unavailable, trying next...`);
          lastError = new Error(`OpenRouter API error ${res.status}: ${errText}`);
          continue;
        }
        throw new Error(`OpenRouter API error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      if (data.usage) {
        console.log(`📊 Token Usage [${model}]:`, data.usage);
      }
      const content = data.choices?.[0]?.message?.content ?? '';
      if (content) return content;
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} failed:`, err.message);
    }
  }

  throw lastError ?? new Error('All AI models failed to respond');
}

/**
 * Log queries for auditing and performance tracking
 */
async function logQuery(data: {
  user_role?: string;
  question: string;
  sql_used?: string;
  api_called?: string;
  response_summary: string;
  latency_ms: number;
}) {
  try {
    await pool.execute(
      'INSERT INTO query_logs (user_role, question, sql_used, api_called, response_summary, latency_ms) VALUES (?, ?, ?, ?, ?, ?)',
      [
        data.user_role || 'user',
        data.question,
        data.sql_used || null,
        data.api_called || null,
        data.response_summary.substring(0, 500),
        data.latency_ms
      ]
    );
  } catch (error) {
    console.error('❌ Failed to log query:', error);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const { messages, userRole = 'user' } = body;

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") {
      return new Response(
        JSON.stringify({ error: "Invalid message format" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user is asking about database queries
    const userContent = lastMessage.content.toLowerCase();
    console.log("User content:", userContent);

    // More comprehensive and intelligent database query detection
    // const databaseKeywords = [
    //   'database', 'table', 'query', 'show me', 'find', 'list', 'get',
    //   'customer', 'account', 'product', 'bill', 'supplier', 'data',
    //   'record', 'information', 'week', 'month', 'today', 'yesterday',
    //   'show tables', 'select', 'from', 'where', 'count', 'sum', 'avg',
    //   'added', 'created', 'updated', 'modified', 'recent', 'latest',
    //   'stock', 'price', 'mrp', 'retail', 'category', 'out of stock',
    //   'low stock', 'inventory', 'sales', 'orders', 'transactions'
    // ];

    const databaseKeywords = [

      // database basics
      'database', 'db', 'schema', 'table', 'tables', 'row', 'rows', 'column', 'columns',
      'record', 'records', 'data', 'dataset', 'entry', 'entries', 'information', 'details',

      // display actions
      'show', 'show me', 'display', 'view', 'see', 'list', 'get', 'fetch', 'retrieve',
      'give', 'give me', 'bring', 'load', 'present', 'print', 'output', 'return',

      // search actions
      'find', 'search', 'look', 'look for', 'lookup', 'check', 'identify', 'locate',
      'scan', 'discover', 'detect', 'track', 'trace',

      // filtering
      'filter', 'filtered', 'where', 'with', 'without', 'having', 'include', 'exclude',
      'containing', 'contains', 'equal', 'equals', 'not equal', 'greater', 'less',
      'greater than', 'less than', 'above', 'below', 'between', 'range',

      // sql operations
      'select', 'from', 'join', 'inner join', 'left join', 'right join', 'group',
      'group by', 'order', 'order by', 'sort', 'limit', 'distinct', 'count',
      'sum', 'avg', 'average', 'min', 'max', 'total', 'calculate', 'aggregate',

      // counting phrases
      'how many', 'number of', 'total number', 'count of', 'quantity of',

      // time related
      'today', 'yesterday', 'tomorrow', 'date', 'time', 'day', 'week', 'month', 'year',
      'daily', 'weekly', 'monthly', 'yearly', 'current', 'last', 'previous',
      'recent', 'latest', 'new', 'old', 'created', 'added', 'updated', 'modified',
      'deleted', 'before', 'after', 'between', 'during', 'range', 'since', 'until',

      // people
      'customer', 'customers', 'client', 'clients', 'user', 'users', 'person', 'people',
      'employee', 'employees', 'staff', 'member', 'members', 'manager', 'admin',
      'agent', 'agents', 'owner', 'owners',

      // organization
      'company', 'companies', 'organization', 'business', 'branch', 'branches',
      'department', 'division', 'team',

      // suppliers
      'supplier', 'suppliers', 'vendor', 'vendors', 'provider', 'providers',
      'manufacturer', 'manufacturers', 'distributor', 'distributors',

      // product related
      'product', 'products', 'item', 'items', 'goods', 'material', 'materials',
      'inventory', 'catalog', 'catalogue', 'brand', 'brands', 'model', 'models',
      'category', 'categories', 'type', 'types', 'variant', 'variants',

      // pricing
      'price', 'prices', 'cost', 'costs', 'amount', 'value', 'mrp', 'retail',
      'wholesale', 'discount', 'offer', 'margin', 'profit', 'revenue', 'income',
      'expense', 'expenses', 'budget', 'rate',

      // stock and inventory
      'stock', 'stocks', 'inventory', 'available', 'availability',
      'out of stock', 'low stock', 'remaining', 'balance', 'quantity',
      'qty', 'units', 'warehouse', 'location', 'store', 'branch stock',

      // sales
      'sale', 'sales', 'sell', 'sold', 'selling', 'order', 'orders',
      'purchase', 'purchases', 'transaction', 'transactions',
      'invoice', 'invoices', 'billing', 'bill', 'payment', 'payments',
      'receipt', 'receipts', 'refund', 'refunds', 'return', 'returns',

      // logistics
      'shipment', 'shipments', 'delivery', 'deliveries', 'dispatch', 'tracking',

      // crm
      'lead', 'leads', 'opportunity', 'opportunities', 'contact', 'contacts',

      // analytics
      'report', 'reports', 'summary', 'analysis', 'analytics', 'statistics',
      'trend', 'trends', 'growth', 'performance', 'comparison', 'metrics',

      // ranking
      'top', 'top 5', 'top 10', 'highest', 'lowest', 'best', 'worst', 'most', 'least',
      'rank', 'ranking', 'popular', 'frequent', 'rare',

      // operations
      'added', 'created', 'inserted', 'updated', 'changed', 'modified',
      'removed', 'deleted', 'replaced',

      // financial metrics
      'revenue', 'profit', 'loss', 'margin', 'turnover', 'sales amount',
      'total sales', 'gross', 'net', 'balance', 'credit', 'debit',

      // plain english questions
      'what', 'which', 'who', 'when', 'where', 'why', 'how',

      // natural language patterns
      'show all', 'give all', 'display all', 'get all',
      'show details', 'full details', 'complete list', 'full report',
      'latest records', 'recent records', 'new records', 'old records',

      // comparison
      'compare', 'comparison', 'difference', 'versus', 'vs',

      // status
      'status', 'active', 'inactive', 'pending', 'completed', 'cancelled',

      // misc business
      'project', 'projects', 'task', 'tasks', 'activity', 'activities',
      'ticket', 'tickets', 'issue', 'issues',

      // question starters
      'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',

      // request words
      'can', 'could', 'will', 'would', 'should', 'may', 'might',

      // asking for information
      'tell me', 'tell me about', 'explain', 'describe', 'define',
      'give details', 'provide details', 'show details', 'more details',
      'full details', 'complete details', 'information about',

      // listing requests
      'show all', 'give all', 'list all', 'display all', 'get all',
      'show list', 'give list', 'list out', 'display list',

      // information words
      'details', 'detail', 'info', 'information', 'description',
      'summary', 'overview', 'explanation',

      // asking for examples
      'example', 'examples', 'sample', 'samples',

      // asking quantity
      'how many', 'how much', 'total number', 'number of',

      // asking comparison
      'which one', 'which is better', 'which is higher', 'which is lower',
      'compare', 'comparison', 'difference between',

      // asking status
      'status of', 'current status', 'latest status',

      // asking time
      'when was', 'when did', 'when is', 'how long', 'since when',

      // asking reason
      'why is', 'why was', 'reason for', 'cause of',

      // asking process
      'how to', 'how do i', 'how does', 'how can i', 'steps to',

      // asking identification
      'who is', 'who are', 'which one is', 'what is',

      // asking location
      'where is', 'where are', 'location of',

      // asking explanation
      'what does', 'what do', 'what did', 'what happened',

      // casual user phrases
      'i want', 'i need', 'please show', 'please give', 'can you show',
      'can you give', 'can you tell', 'let me see', 'i would like',

      // report style
      'show report', 'give report', 'generate report',
      'show summary', 'give summary', 'generate summary'
    ];
    // Enhanced detection logic with better pattern matching
    const isDatabaseQuery = databaseKeywords.some(keyword => userContent.includes(keyword)) ||
      userContent.includes('show') ||
      userContent.includes('list') ||
      userContent.includes('get') ||
      // Detect time-based queries
      (userContent.includes('last') && (userContent.includes('week') || userContent.includes('month') || userContent.includes('day'))) ||
      // Detect queries about recently added items
      (userContent.includes('added') || userContent.includes('created')) &&
      (userContent.includes('this') || userContent.includes('last') || userContent.includes('recent'));

    // Additional validation to reduce false positives
    const nonDatabasePhrases = [
      'weather', 'news', 'joke', 'recipe', 'movie', 'song', 'react', 'javascript',
      'python', 'java', 'css', 'html', 'framework', 'library', 'programming',
      'code', 'development', 'software', 'application', 'app', 'web', 'design',
      'tutorial', 'learn', 'teach', 'explain', 'definition', 'meaning'
    ];
    const isNonDatabaseQuery = nonDatabasePhrases.some(phrase => userContent.includes(phrase));

    console.log("Is database query:", isDatabaseQuery);
    console.log("Is non-database query:", isNonDatabaseQuery);

    // If it's not a database query, provide a friendly response
    if (!isDatabaseQuery || isNonDatabaseQuery) {
      return new Response(
        JSON.stringify({
          response: "I'm designed to help you query your database. I can help you find products, check stock levels, list customers, view sales data, and more. Try asking something like:\n\n• Show me 5 products\n• List customers with low stock items\n• What products have MRP less than 20?\n• Show me recent transactions\n\nWhat database information would you like to explore?"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (isDatabaseQuery && !isNonDatabaseQuery) {
      console.log("Handling as natural language database query");
      // Handle database-related queries with natural language processing
      return await handleNaturalLanguageQuery(lastMessage.content, messages, userRole, startTime);
    }

    console.log("Sending request to OpenRouter AI...");

    try {
      const aiResponse = await callAI(
        messages.map(msg => ({ role: msg.role, content: msg.content })),
        0.7
      );

      if (!aiResponse) {
        throw new Error("Empty response from AI");
      }

      console.log("Final AI response:", aiResponse.substring(0, 100) + "...");

      return new Response(
        JSON.stringify({ response: aiResponse }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (apiError: any) {
      console.error("AI API error:", apiError);
      return new Response(
        JSON.stringify({
          response: `AI Error: ${apiError.message || "Unknown error calling AI service"}`
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    // Type guard to safely access error properties
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    console.error("Error in chat API:", error);
    return new Response(
      JSON.stringify({
        response: `Sorry, I encountered an error: ${errorMessage}`
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Handle natural language database queries
async function handleNaturalLanguageQuery(userQuery: string, conversationHistory: any[], userRole: string = 'user', startTime: number = Date.now()) {
  try {
    // 1. Get database schema information
    let schemaInfo = {};
    try {
      schemaInfo = await getDatabaseSchema();
    } catch (schemaError: any) {
      console.error("Error getting database schema:", schemaError);
    }

    // 2. Get active API Connectors
    let apiConnectors: any[] = [];
    try {
      const [rows]: any = await pool.query('SELECT name, description, method FROM api_connectors WHERE is_active = 1');
      apiConnectors = rows;
    } catch (apiError) {
      console.error("Error fetching API connectors:", apiError);
    }

    // 3. Create a comprehensive context for the AI
    const schemaDescription = Object.entries(schemaInfo)
      .map(([tableName, tableInfo]: [string, any]) => {
        const columns = tableInfo.columns || [];
        const rowCount = tableInfo.rowCount || 0;
        const columnDescriptions = columns.map((col: any) =>
          `${col.COLUMN_NAME || col.column_name} (${col.DATA_TYPE || col.data_type})${col.IS_NULLABLE === 'YES' ? ' (nullable)' : ''}${col.EXTRA ? ` (${col.EXTRA})` : ''}`
        ).join(', ');
        return `${tableName} (${rowCount} rows): ${columnDescriptions}`;
      })
      .join('\n');

    let conversationContext = "";
    if (conversationHistory.length > 1) {
      const recentMessages = conversationHistory.slice(-12);
      conversationContext = recentMessages
        .filter(msg => msg.role !== "system")
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n');
    }

    // Build current context summary for the SLM
    const contextPrompt = `
    AVAILABLE DATA SOURCES:
    
    1. MYSQL DATABASE TABLES:
    ${JSON.stringify(schemaInfo, null, 2)}
    
    2. EXTERNAL API CONNECTORS:
    ${apiConnectors.length > 0 
      ? apiConnectors.map((c: any) => `- NAME: "${c.name}" | URL: "${c.url}" | DESC: "${c.description || 'N/A'}"`).join('\n')
      : 'No active API connectors found.'}

    CONVERSATION RULES:
    - If the user asks for data from a specific API (by Name or Description), use: CALL_API:{"name":"ConnectorName", "params":{...}}
    - If the user asks for data in the MySQL database, use standard SQL.
    - IMPORTANT: If the user refers to "previous data", "the file", "the API", or asks a follow-up question (e.g., "count them", "total for [column]"), refer to the MOST RECENT data source mentioned in the conversation.
    - If the result of a previous CALL_API matched the user's intent, do not switch to SQL unless they ask for a database table.
    - RESPOND ONLY WITH THE COMMAND (SQL OR CALL_API). NO EXTRA TEXT.
    `;

    const aiPrompt = `
${contextPrompt}

${conversationContext ? `CONVERSATION SO FAR:\n${conversationContext}\n` : ''}

USER QUESTION: "${userQuery}"

FINAL INSTRUCTION: Respond with ONLY the required SQL or CALL_API command.
`;

    let aiResponse_raw = await callAI(
      [
        { role: "system", content: "You are a data assistant. Respond ONLY with a SQL query or a CALL_API command. No extra text." },
        { role: "user", content: aiPrompt }
      ],
      0.1
    );

    let aiResponse = aiResponse_raw.trim().replace(/```sql/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
    console.log("AI Response:", aiResponse);

    // 4. Handle API Call vs SQL Execution
    let results: any = null;
    let isApiCall = false;
    let apiName = "";
    let sqlQuery = "";

    if (aiResponse.startsWith("CALL_API:")) {
      isApiCall = true;
      try {
        const callDataStr = aiResponse.replace("CALL_API:", "").trim();
        const callData = JSON.parse(callDataStr);
        apiName = callData.name;
        
        const [connectors]: any = await pool.query('SELECT * FROM api_connectors WHERE name = ? AND is_active = 1', [callData.name]);
        if (connectors.length === 0) throw new Error(`Connector ${callData.name} not found`);
        
        const result = await callExternalAPI(connectors[0], callData.params);
        results = result.success ? normalizeAPIResponse(result.data) : null;
        
        if (!result.success) throw new Error(result.error || "API call failed");
        
        const endTime = Date.now();
        logQuery({
          user_role: userRole,
          question: userQuery,
          api_called: apiName,
          response_summary: `Success (${Array.isArray(results) ? results.length : '1'} records)`,
          latency_ms: endTime - startTime
        });
      } catch (err: any) {
        const endTime = Date.now();
        logQuery({
          user_role: userRole,
          question: userQuery,
          api_called: apiName || "Unknown",
          response_summary: `API Error: ${err.message}`,
          latency_ms: endTime - startTime
        });
        return new Response(JSON.stringify({ response: `Failed to execute API call: ${err.message}` }), { status: 200 });
      }
    } else {
      // 5. Handle SQL Query
      sqlQuery = aiResponse;
      if (sqlQuery === "INVALID_QUERY" || sqlQuery.includes("INVALID_QUERY")) {
        return new Response(JSON.stringify({ response: "I'm sorry, I couldn't understand your query. Please try rephrasing." }), { status: 200 });
      }

      if (!sqlQuery.toLowerCase().startsWith('select')) {
        return new Response(JSON.stringify({ response: "I can only help with data retrieval queries." }), { status: 200 });
      }

      try {
        results = await executeQuery(sqlQuery);
      } catch (queryError: any) {
        console.error("SQL execution error:", queryError);
        let errorMessage = queryError.message || "Unknown database error";
        return new Response(JSON.stringify({ response: `Database Error: ${errorMessage}` }), { status: 200 });
      }
    }

    // Format results in a more user-friendly way using AI summarization
    let formattedResponse = "";

    try {
      // Create a summarized response using the AI, similar to Excel mode
      formattedResponse = await summarizeResults(userQuery, results, isApiCall ? apiName : 'Database');
    } catch (summaryError: any) {
      console.error("Summary generation error:", summaryError);
      // Fallback to basic summary if AI fails
      if (Array.isArray(results) && results.length > 0) {
        if (results.length === 1 && Object.keys(results[0]).length === 1) {
          const value = Object.values(results[0])[0];
          const key = Object.keys(results[0])[0];
          formattedResponse = `### ✅ Summary\nI found **${value}** ${key.replace(/_/g, ' ')} matching your query.\n`;
        } else {
          formattedResponse = `### ✅ Summary\nI found **${results.length}** records matching your query.\n\n`;
        }
      } else {
        formattedResponse = "### ❌ Result\nI found no data matching your query.";
      }
    }

    const endTime = Date.now();
    const responseText = typeof formattedResponse === 'string' ? formattedResponse : "I found some data.";

    // Async logging - don't wait for it
    logQuery({
      user_role: userRole,
      question: userQuery,
      sql_used: isApiCall ? `API: ${apiName}` : aiResponse,
      response_summary: responseText.substring(0, 500),
      latency_ms: endTime - startTime
    });

    return new Response(
      JSON.stringify({
        response: formattedResponse,
        data: results
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Natural language query error:", error);
    return new Response(
      JSON.stringify({
        response: `I encountered an error while processing your query: ${error.message}`
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Intelligent summarization of data results using AI
 */
async function summarizeResults(question: string, results: any, sourceName: string): Promise<string> {
  const dataArray = Array.isArray(results) ? results : (results && typeof results === 'object' ? [results] : []);
  if (dataArray.length === 0) return "I found no data matching your query.";

  const sampleSize = 15;
  const sampleData = dataArray.slice(0, sampleSize);
  const totalCount = dataArray.length;
  const headers = Object.keys(dataArray[0] || {});

  const prompt = `
    You are a professional Data Analyst assistant. A user asked: "${question}"
    
    The data source is: ${sourceName}
    Total Records Found: ${totalCount}
    Headers: ${headers.join(", ")}
    
    SAMPLE DATA (First ${sampleData.length} rows):
    ${JSON.stringify(sampleData, null, 2)}
    
    INSTRUCTIONS:
    1. Provide a direct, helpful answer to the user's question based on the data provided.
    2. If the user asked for a count, total, average, or specific value, calculate it precisely using ALL rows (if it's simple to see from the sample or metadata) or mention the total records if you only have a sample.
    3. IMPORTANT: Structure your response with these sections:
       - Start with a direct answer or a concise table if relevant.
       - "### ✅ Summary" explaining what was found.
       - "### 💡 Key Insights" with 2-3 brief bullet points about patterns in the data.
       - "### 🔍 Suggested Follow-up Questions" with 3-4 specific questions based on this data.
    4. Keep the response professional but conversational.
    5. Always format numbers clearly (e.g., $1,234.56).
    6. If the data is empty or irrelevant to the question, explain why.
  `;

  return await callAI([{ role: "user", content: prompt }], 0.2);
}
