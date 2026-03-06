import { NextRequest } from "next/server";
import { executeQuery, getDatabaseSchema } from '@/lib/dataAccess';

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
      const content = data.choices?.[0]?.message?.content ?? '';
      if (content) return content;
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} failed:`, err.message);
    }
  }

  throw lastError ?? new Error('All AI models failed to respond');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body;

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
      return await handleNaturalLanguageQuery(lastMessage.content, messages);
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
async function handleNaturalLanguageQuery(userQuery: string, conversationHistory: any[]) {
  try {
    // Get database schema information
    let schemaInfo = {};
    try {
      schemaInfo = await getDatabaseSchema();
    } catch (schemaError: any) {
      console.error("Error getting database schema:", schemaError);

      // Handle specific authentication errors
      if (schemaError.message.includes("Access denied")) {
        return new Response(
          JSON.stringify({
            response: `⚠️ **Database Connection Error**: I couldn't connect to your MySQL database because the access was denied. 

Please check your **.env** file and verify:
• **DB_USER**: Is it correct? (usually 'root')
• **DB_PASSWORD**: Is it correct? (many local setups have no password)
• **DB_NAME**: Does the database '${process.env.DB_NAME}' exist?

If you meant to use **Excel Analysis Mode**, please upload your file again to enable it.`
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // Continue with empty schema - the AI might still be able to help with general SQL knowledge
    }

    // Create a prompt for the AI to generate SQL based on natural language
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

    // Extract recent conversation context (last 3 exchanges) for better context
    let conversationContext = "";
    if (conversationHistory.length > 1) {
      // Get the last 3 exchanges (6 messages = 3 user + 3 assistant)
      const recentMessages = conversationHistory.slice(-12);
      conversationContext = recentMessages
        .filter(msg => msg.role !== "system") // Filter out system messages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n');
    }

    // Enhanced prompt with conversation context
    const aiPrompt = `
You are a database expert that translates natural language queries into SQL queries. 
Use the following database schema:

${schemaDescription}

${conversationContext ? `Previous conversation context:
${conversationContext}

` : ''}
Important notes about the database:
- Date fields are stored as VARCHAR, not DATE type
- Common date formats in the database: 'YYYY-MM-DD'
- When comparing dates, use STR_TO_DATE() function
- For time-based queries, use functions like CURDATE(), DATE_SUB(), etc.

Examples of natural language queries and their SQL translations:
- "Show me all customers" -> SELECT * FROM customer WHERE is_deleted = 0
- "List products added this week" -> SELECT * FROM products WHERE STR_TO_DATE(MfgDate, '%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL 1 WEEK) AND is_deleted = 0
- "Find suppliers from New York" -> SELECT * FROM supplier WHERE city = 'New York'
- "Show products that expire next month" -> SELECT * FROM products WHERE STR_TO_DATE(ExpiryDate, '%Y-%m-%d') BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 MONTH) AND is_deleted = 0

User query: "${userQuery}"

Please provide a valid SQL query that answers the user's request. 
Respond ONLY with the SQL query and nothing else. No explanations, no reasoning, no extra text.
Important guidelines:
1. Always use SELECT statements for data retrieval
2. Handle time-based queries appropriately using STR_TO_DATE for VARCHAR date fields
3. Respect soft-delete patterns if is_deleted column exists (WHERE is_deleted = 0)
4. Use appropriate date functions for temporal queries
5. If the query is unclear or you cannot generate a valid SQL query, respond with "INVALID_QUERY".
`;

    console.log("Generating SQL with OpenRouter AI...");
    const sqlQuery_raw = await callAI(
      [
        { role: "system", content: "You are a database expert that translates natural language queries into SQL queries. Respond ONLY with the SQL query and nothing else. Always use proper SQL syntax, handle date/time queries correctly using STR_TO_DATE for VARCHAR date fields, and respect soft-delete patterns. Use MySQL-compatible functions." },
        { role: "user", content: aiPrompt }
      ],
      0.1
    );

    let sqlQuery = sqlQuery_raw.trim();
    console.log("AI generated SQL query:", sqlQuery);

    // Check if we got an empty response
    if (!sqlQuery || sqlQuery.length === 0) {
      return new Response(
        JSON.stringify({
          response: "I'm sorry, I couldn't generate a query for your request. Please try rephrasing or ask something like 'Show me all customers' or 'List products added this week'."
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the AI couldn't generate a valid query
    if (sqlQuery === "INVALID_QUERY" || sqlQuery.includes("INVALID_QUERY")) {
      return new Response(
        JSON.stringify({
          response: "I'm sorry, I couldn't understand your query. Please try rephrasing or ask something like 'Show me all customers' or 'List products added this week'."
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clean the SQL query - remove any markdown formatting or extra text
    sqlQuery = sqlQuery.replace(/```sql/g, '').replace(/```/g, '').trim();

    // Validate that it's a SELECT query for safety
    if (!sqlQuery.toLowerCase().startsWith('select')) {
      return new Response(
        JSON.stringify({
          response: "I can only help with data retrieval queries (SELECT statements). Please ask a question that involves retrieving data from the database."
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Generated SQL query:", sqlQuery);

    // Execute the generated SQL query
    let results: any;
    try {
      results = await executeQuery(sqlQuery);
    } catch (queryError: any) {
      console.error("SQL execution error:", queryError);
      // Try to provide a helpful error message
      let errorMessage = queryError.message || "Unknown database error";

      // Check for common SQL errors and provide better guidance
      if (errorMessage.includes("Unknown column")) {
        errorMessage = "I generated an invalid query with a column that doesn't exist. Please try rephrasing your question.";
      } else if (errorMessage.includes("Table") && errorMessage.includes("doesn't exist")) {
        errorMessage = "I generated an invalid query with a table that doesn't exist. Please check your question.";
      } else if (errorMessage.includes("syntax")) {
        errorMessage = "I generated an invalid SQL query due to syntax errors. Please try rephrasing your question.";
      }

      return new Response(
        JSON.stringify({
          response: `I encountered a database error: ${errorMessage}`
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // If results are empty, provide a friendly message
    if (!results || (Array.isArray(results) && results.length === 0)) {
      return new Response(
        JSON.stringify({
          response: "I found no data matching your query."
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Limit result size for better UX
    const resultSize = JSON.stringify(results).length;
    if (resultSize > 50000) { // ~50KB limit
      return new Response(
        JSON.stringify({
          response: `I found ${Array.isArray(results) ? results.length : 'some'} records, but the results are too large to display. Try adding more specific filters to your query.`
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Format results in a more user-friendly way
    let formattedResponse = "";

    if (Array.isArray(results) && results.length > 0) {
      // For count queries (single row with single column)
      if (results.length === 1 && Object.keys(results[0]).length === 1) {
        const value = Object.values(results[0])[0];
        const key = Object.keys(results[0])[0];
        formattedResponse = `I found ${value} ${key.replace(/_/g, ' ')}.`;
      }
      // For small result sets (5 or fewer), format them as a concise list
      else if (results.length <= 5) {
        formattedResponse = "I found the following data:\n\n";
        results.forEach((row: any, index) => {
          formattedResponse += `${index + 1}. `;
          const entries = Object.entries(row);

          // Identify important fields based on common patterns
          const priorityPatterns = [
            'id', 'name', 'title', 'description', 'price', 'cost', 'mrp', 'amount',
            'stock', 'quantity', 'count', 'status', 'type', 'category'
          ];

          // Find priority fields (case insensitive)
          const priorityEntries = entries.filter(([key]) =>
            priorityPatterns.some(pattern =>
              key.toLowerCase().includes(pattern)
            )
          );

          // If we found priority fields, use up to 4 of them
          if (priorityEntries.length > 0) {
            const displayEntries = priorityEntries.slice(0, Math.min(4, priorityEntries.length));
            formattedResponse += displayEntries.map(([key, value]) => `${key}: ${value}`).join(", ") + "\n";
          } else if (entries.length <= 3) {
            // For other data with few columns, show all
            formattedResponse += entries.map(([key, value]) => `${key}: ${value}`).join(", ") + "\n";
          } else {
            // For data with many columns, show first 3
            const firstThree = entries.slice(0, 3);
            formattedResponse += firstThree.map(([key, value]) => `${key}: ${value}`).join(", ") + "\n";
          }
        });
      }
      // For larger result sets, provide a summary with sample data
      else {
        formattedResponse = `I found ${results.length} records matching your query. Here are the first 3 results:\n\n`;
        results.slice(0, 3).forEach((row: any, index) => {
          formattedResponse += `${index + 1}. `;

          // Identify important fields based on common patterns
          const entries = Object.entries(row);
          const priorityPatterns = [
            'id', 'name', 'title', 'description', 'price', 'cost', 'mrp', 'amount',
            'stock', 'quantity', 'count', 'status', 'type', 'category'
          ];

          // Find priority fields (case insensitive)
          const priorityEntries = entries.filter(([key]) =>
            priorityPatterns.some(pattern =>
              key.toLowerCase().includes(pattern)
            )
          );

          // If we found priority fields, use up to 4 of them
          if (priorityEntries.length > 0) {
            const displayEntries = priorityEntries.slice(0, Math.min(4, priorityEntries.length));
            formattedResponse += displayEntries.map(([key, value]) => `${key}: ${value}`).join(", ") + "\n";
          } else {
            // For other data, show first 3 columns
            const firstThree = entries.slice(0, 3);
            formattedResponse += firstThree.map(([key, value]) => `${key}: ${value}`).join(", ") + "\n";
          }
        });

        if (results.length > 3) {
          formattedResponse += `\n... and ${results.length - 3} more records.`;
        }
      }
    } else {
      formattedResponse = "I found no data matching your query.";
    }

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
