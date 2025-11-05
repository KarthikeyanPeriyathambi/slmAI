import { NextRequest } from "next/server";
import { executeQuery, getDatabaseSchema } from '@/lib/dataAccess';

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
    const databaseKeywords = [
      'database', 'table', 'query', 'show me', 'find', 'list', 'get', 
      'customer', 'account', 'product', 'bill', 'supplier', 'data', 
      'record', 'information', 'week', 'month', 'today', 'yesterday',
      'show tables', 'select', 'from', 'where', 'count', 'sum', 'avg',
      'added', 'created', 'updated', 'modified', 'recent', 'latest',
      'stock', 'price', 'mrp', 'retail', 'category', 'out of stock',
      'low stock', 'inventory', 'sales', 'orders', 'transactions'
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

    // Get API key and URL from environment variables
    const SLM_API_KEY = process.env.SLM_API_KEY;
    const SLM_API_URL = process.env.SLM_API_URL || "https://openrouter.ai/api/v1/chat/completions";

    // Check if API key is configured
    if (!SLM_API_KEY) {
      console.error("SLM_API_KEY is not configured");
      return new Response(
        JSON.stringify({ 
          response: "Server configuration error: API key not found." 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare the request payload with model specification
    const payload = {
      model: "minimax/minimax-m2:free", // Using the model from your example
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      // Add other common parameters
      // temperature: 0.7,
      // max_tokens: 500,
    };

    console.log("Sending request to SLM API with payload:", JSON.stringify(payload, null, 2));

    // Call the SLM API with OpenRouter specific headers
    const response = await fetch(SLM_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLM_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000', // Optional site URL for rankings
        'X-Title': 'SLM Chat App' // Optional site title for rankings
      },
      body: JSON.stringify(payload)
    });

    // Log the response status and headers for debugging
    console.log(`SLM API Response Status: ${response.status}`);
    
    // Try to get response text for debugging
    const responseText = await response.text();
    console.log(`SLM API Response Text: ${responseText.substring(0, 500)}...`); // Log first 500 chars

    if (!response.ok) {
      console.error(`SLM API error: ${response.status}`, responseText);
      return new Response(
        JSON.stringify({ 
          response: `API Error: ${response.status} - ${responseText.substring(0, 200)}` 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Try to parse JSON, but handle if it's not valid JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse API response as JSON:", responseText);
      return new Response(
        JSON.stringify({ 
          response: "Invalid API response format. Please check the API documentation." 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Parsed API response:", JSON.stringify(data, null, 2));

    // Extract the response text from the API response
    // Handle different possible response formats
    let aiResponse = "";
    
    // Format 1: OpenAI-like format (OpenRouter uses this)
    if (data.choices && data.choices[0] && data.choices[0].message) {
      aiResponse = data.choices[0].message.content;
      console.log("Using OpenAI-like response format");
    }
    // Format 2: Direct response format
    else if (data.response) {
      aiResponse = data.response;
      console.log("Using direct response format");
    }
    // Format 3: Content field
    else if (data.content) {
      aiResponse = data.content;
      console.log("Using content field format");
    }
    // Format 4: Text field
    else if (data.text) {
      aiResponse = data.text;
      console.log("Using text field format");
    }
    // If we can't find the response text, return the whole data as string
    else {
      aiResponse = JSON.stringify(data, null, 2);
      console.warn("Unexpected API response format, returning full response:", data);
    }

    // If we still don't have a response, return an error
    if (!aiResponse) {
      console.error("Empty response from API:", data);
      return new Response(
        JSON.stringify({ 
          response: "Received empty response from the AI service." 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Final AI response:", aiResponse.substring(0, 100) + "..."); // Log first 100 chars

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
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
    } catch (schemaError) {
      console.error("Error getting database schema:", schemaError);
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

    // Get API key and URL from environment variables
    const SLM_API_KEY = process.env.SLM_API_KEY;
    const SLM_API_URL = process.env.SLM_API_URL || "https://openrouter.ai/api/v1/chat/completions";

    // Prepare the request payload with better parameters for SQL generation
    const payload = {
      model: "minimax/minimax-m2:free",
      messages: [
        { role: "system", content: "You are a database expert that translates natural language queries into SQL queries. Respond ONLY with the SQL query and nothing else. Always use proper SQL syntax, handle date/time queries correctly using STR_TO_DATE for VARCHAR date fields, and respect soft-delete patterns. Use MySQL-compatible functions." },
        { role: "user", content: aiPrompt }
      ],
      temperature: 0.2, // Lower temperature for more consistent results
      max_tokens: 800, // Increased token limit for complex queries
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.2
    };

    // Call the SLM API to convert natural language to SQL
    const response = await fetch(SLM_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLM_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'SLM Chat App'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Fallback mechanism if the first attempt fails
    let fallbackAttempt = false;
    if ((!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) && 
        (!data.response && !data.content)) {
      // Try with a simpler prompt
      console.log("First attempt failed, trying with simplified prompt");
      fallbackAttempt = true;
      const simplifiedPrompt = `Database schema:
${schemaDescription}
${conversationContext ? `\nPrevious conversation context:\n${conversationContext}\n` : ''}
Convert to SQL: ${userQuery}
Respond ONLY with SQL.`;
      const simplifiedPayload = {
        model: "minimax/minimax-m2:free",
        messages: [
          { role: "system", content: "You convert natural language to SQL. Respond ONLY with the SQL query." },
          { role: "user", content: simplifiedPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      };
      
      const fallbackResponse = await fetch(SLM_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLM_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'SLM Chat App'
        },
        body: JSON.stringify(simplifiedPayload)
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        // Merge with original data
        if (fallbackData.choices && fallbackData.choices[0] && fallbackData.choices[0].message) {
          data.choices = fallbackData.choices;
        } else if (fallbackData.response) {
          data.response = fallbackData.response;
        }
      }
    }
    
    // Extract the SQL query from the AI response
    let sqlQuery = "";
    
    // Handle different possible response formats
    if (data.choices && data.choices[0] && data.choices[0].message) {
      sqlQuery = data.choices[0].message.content.trim();
    } else if (data.response) {
      sqlQuery = data.response.trim();
    } else if (data.content) {
      sqlQuery = data.content.trim();
    } else {
      sqlQuery = JSON.stringify(data);
    }
    
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
    
    // Format results for response
    const formattedResults = JSON.stringify(results, null, 2);
    
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