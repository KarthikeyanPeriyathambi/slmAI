"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Database, Sparkles } from "lucide-react";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  type?: "text" | "data" | "error";
  data?: any;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only scroll to bottom after the first message is added
    if (messages.length > 0 && hasInitialized.current) {
      scrollToBottom();
    } else if (messages.length > 0 && !hasInitialized.current) {
      // Mark as initialized after the first message
      hasInitialized.current = true;
    }
  }, [messages]);

  // Parse and format data responses
  const formatDataResponse = (content: string, data: any) => {
    // If we have formatted data from the API, display it nicely
    if (content.includes("I found the following data:") && data) {
      // Check if it's a simple count result
      if (Array.isArray(data) && data.length === 1 && Object.keys(data[0]).length === 1) {
        const value = Object.values(data[0])[0];
        const key = Object.keys(data[0])[0];
        return (
          <div className="space-y-3">
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
              Query Result:
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {String(value)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {key.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        );
      }
      
      // For product lists and other structured data - show only important columns
      if (Array.isArray(data)) {
        // Define important columns for different table types based on common patterns
        const getImportantColumns = (sampleRow: any) => {
          const columns = Object.keys(sampleRow);
          
          // Prioritize common important column patterns
          const priorityPatterns = [
            'id', 'name', 'title', 'description', 'price', 'cost', 'mrp', 'amount',
            'stock', 'quantity', 'count', 'status', 'type', 'category'
          ];
          
          // Find columns that match priority patterns (case insensitive)
          const priorityColumns = columns.filter(col => 
            priorityPatterns.some(pattern => 
              col.toLowerCase().includes(pattern)
            )
          );
          
          // If we found priority columns, use up to 4 of them
          if (priorityColumns.length > 0) {
            return priorityColumns.slice(0, Math.min(4, priorityColumns.length));
          }
          
          // Fallback: use first 3-4 columns
          return columns.slice(0, Math.min(4, columns.length));
        };
        
        const importantColumns = data.length > 0 ? getImportantColumns(data[0]) : [];
        
        return (
          <div className="space-y-3">
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
              Query Results ({data.length} records):
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-auto custom-scrollbar">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.map((row: any, index: number) => (
                    <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900">
                      <div className="grid grid-cols-1 gap-2">
                        {importantColumns.map((col) => (
                          <div key={col} className="flex">
                            <span className="font-medium text-gray-700 dark:text-gray-300 w-full">
                              {col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                            </span>
                            <span className="text-gray-600 dark:text-gray-400 ml-2">
                              {row[col] === null ? (
                                <span className="text-gray-400 dark:text-gray-500 italic">null</span>
                              ) : (
                                String(row[col])
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }
    }
    
    // For text-based responses from the AI
    if (content.includes("I found the following data:") && !data) {
      // Try to parse the content to see if it's JSON
      try {
        const lines = content.split('\n');
        if (lines.length > 2) {
          // Remove the first two lines ("I found the following data:" and empty line)
          const dataLines = lines.slice(2);
          
          // Check if it's a table format
          if (dataLines[1] && dataLines[1].includes('---')) {
            // Table format detected
            const headers = dataLines[0].split(' | ').map(h => h.trim());
            const rows = dataLines.slice(2).map(row => row.split(' | ').map(cell => cell.trim()));
            
            // Show only first 3 columns for concise display
            const displayHeaders = headers.slice(0, 3);
            const displayRows = rows.map(row => row.slice(0, 3));
            
            return (
              <div className="space-y-3">
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Query Results:
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-auto custom-scrollbar">
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {displayRows.map((row, rowIndex) => (
                        <div key={rowIndex} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900">
                          <div className="grid grid-cols-1 gap-2">
                            {displayHeaders.map((header, index) => (
                              <div key={index} className="flex">
                                <span className="font-medium text-gray-700 dark:text-gray-300 w-full">
                                  {header}:
                                </span>
                                <span className="text-gray-600 dark:text-gray-400 ml-2">
                                  {row[index]}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
        }
      } catch (e) {
        // If parsing fails, fall back to plain text
        return <div className="whitespace-pre-wrap">{content}</div>;
      }
    }
    
    // Default fallback
    return <div className="whitespace-pre-wrap">{content}</div>;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Call the SLM API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add assistant message with type detection
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: "assistant",
        timestamp: new Date(),
        type: data.response.includes("I found the following data") ? "data" : "text",
        data: data.data || null,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I encountered an error. Please try again.",
        role: "assistant",
        timestamp: new Date(),
        type: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const quickQueries = [
    "Show last 5 products",
    "Products with MRP 280",
    "List all categories",
    "Low stock items",
  ];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900"> 
      <div className="max-w-[80%] mx-auto flex-1 overflow-hidden  w-full flex">
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 p-6 hidden lg:block">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Database size={16} />
                Quick Queries
              </h3>
              <div className="space-y-2">
                {quickQueries.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(query)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 text-sm text-gray-700 dark:text-gray-300"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                <Bot size={14} />
                Pro Tips
              </h4>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Use natural language queries</li>
                <li>• Ask for specific filters</li>
                <li>• Request data in table format</li>
                <li>• Use "show only" for filtering</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-3xl shadow-2xl">
                  <Bot className="text-white" size={64} />
                </div>
                <div className="space-y-4 max-w-2xl">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
                    Database Intelligence
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    Ask questions about your data in plain English and get instant, formatted results
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Database size={16} />
                      Data Queries
                    </h3>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        "Show products with MRP 280"
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        "Last 5 added items"
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        "Low stock alerts"
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Sparkles size={16} />
                      Smart Features
                    </h3>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        Natural language queries
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        Intelligent data filtering
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        Formatted results
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 max-w-2xl">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <Bot size={16} />
                    Note
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This application is designed specifically for database queries. Ask about products, customers, inventory, sales, or other business data to get started.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Bot size={16} className="text-white" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                        : message.type === "error"
                        ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">
                      {message.type === "data" && message.data
                        ? formatDataResponse(message.content, message.data)
                        : message.content}
                    </div>
                    <div
                      className={`text-xs mt-3 flex items-center gap-2 ${
                        message.role === "user"
                          ? "text-blue-100"
                          : message.type === "error"
                          ? "text-red-500"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {message.role === "user" ? <User size={12} /> : <Bot size={12} />}
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {message.type === "data" && (
                        <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-full text-xs">
                          DATA
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                      <User size={16} className="text-white" />
                    </div>
                  )}
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Analyzing your query...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="backdrop-blur-sm p-6">
            <form onSubmit={handleSubmit} className="w-full">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your data... (Try: 'Show products with MRP 280' or 'Last 5 items')"
                    className="w-full border border-gray-300 dark:border-gray-700 rounded-2xl px-6 py-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white resize-none shadow-sm hover:shadow-md transition-shadow"
                    disabled={isLoading}
                    rows={1}
                    style={{
                      minHeight: "56px",
                      maxHeight: "120px",
                    }}
                  />
                </div>
                <div>
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-2xl px-6 py-4 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 self-end h-fit"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Send
                </button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <span>• Natural language queries</span>
                <span>• Real-time data filtering</span>
                <span>• Professional formatting</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}