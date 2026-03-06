"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Bot, User, Loader2, Database, Sparkles, Upload, FileSpreadsheet, CheckCircle, XCircle, Menu, X, Lightbulb, Search, MessageSquare, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Components } from "react-markdown";


interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  type?: "text" | "data" | "error" | "upload" | "table";
  data?: any;
}

interface UploadedFile {
  name: string;
  headers: string[];
  rowCount: number;
  mode: 'mysql' | 'excel';
  data?: any[];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'mysql' | 'excel' | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Scroll whenever messages change
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Parse and format data responses
  const formatDataResponse = (content: string, data: any) => {
    // Helper to render the text content if it exists and isn't a duplicate of the data description
    const renderContent = () => {
      if (!content) return null;
      return (
        <div className="markdown-content text-sm text-gray-700 dark:text-gray-300 mb-2 overflow-x-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      );
    };


    // Universal table support
    if (data && Array.isArray(data.data)) {
      const headers = data.headers || Object.keys(data.data[0] || {});
      const MAX_DISPLAY = 100; // Limit for performance
      const displayData = data.data.slice(0, MAX_DISPLAY);
      const hasMore = data.data.length > MAX_DISPLAY;

      return (
        <div className="space-y-4 w-full animate-fadeIn">
          {renderContent()}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 tracking-widest uppercase">
              <FileSpreadsheet size={14} />
              <span>
                {hasMore ? `Preview: ${MAX_DISPLAY} / ${data.data.length} records` : `DataSet: ${data.data.length} records`}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden bg-white dark:bg-gray-900/50">
            <div className="overflow-x-auto custom-scrollbar" style={{ maxHeight: '400px' }}>
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    {headers.map((header: string, idx: number) => (
                      <th key={idx} className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                        {String(header).replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50 font-sans">
                  {displayData.map((row: any, rowIdx: number) => (
                    <tr key={rowIdx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                      {headers.map((header: string, colIdx: number) => (
                        <td key={colIdx} className="px-4 py-2.5 text-[12px] text-gray-700 dark:text-gray-300 border-r border-gray-50/50 dark:border-gray-800/20 last:border-r-0">
                          {row[header] === null || row[header] === undefined ? <span className="text-gray-300 dark:text-gray-600 italic">-</span> : String(row[header])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {hasMore && (
            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-lg p-3 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium text-center">
              ⚠️ Showing first {MAX_DISPLAY} rows. Use specific filters to see more data.
            </div>
          )}
        </div>
      );
    }

    // Handle uploaded file display (fallback)
    if (data && data.headers && Array.isArray(data.data)) {
      return (
        <div className="space-y-3">
          {renderContent()}
          <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
            <CheckCircle size={16} />
            <span>File Comparison View</span>
          </div>
          {/* Table logic similar to above but for uploaded data specifically */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 w-full max-w-full" style={{ maxHeight: '350px' }}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" style={{ minWidth: '600px' }}>
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  {data.headers.map((h: string) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.data.slice(0, 10).map((row: any, i: number) => (
                  <tr key={i}>
                    {data.headers.map((h: string) => (
                      <td key={h} className="px-4 py-2 text-sm text-gray-600">{String(row[h])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

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
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden w-full max-w-full">
              <div className="max-h-[400px] overflow-auto custom-scrollbar">
                <div className="divide-y divide-gray-200 dark:divide-gray-700 min-w-full">
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
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {dataLines.join('\n')}
                  </ReactMarkdown>
                </div>
              </div>
            );

          }
        }
      } catch (e) {
        // If parsing fails, fall back to markdown
        return (
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        );
      }

    }

    // Default fallback
    return (
      <div className="markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: inputValue,
      role: "user",
      timestamp: new Date(),
    };

    const userContent = inputValue;
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
          messages: [...messages, { ...userMessage, content: userContent }],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Add assistant message with type detection
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
      handleAskQuestion(e as any);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    // Auto-detect: If no mode selected, default to Excel mode for file uploads
    const modeToUse = selectedMode || 'excel';

    setIsUploading(true);

    try {
      const newFiles: UploadedFile[] = [];
      let totalRows = 0;
      let allHeaders = new Set<string>();
      let allData: any[] = [];

      for (const file of files.slice(0, 3)) { // Process up to 3 files max
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', modeToUse);

        const response = await fetch('/api/excel', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Upload failed for ${file.name}`);
        }

        const fileData = modeToUse === 'excel' ? data.data : data.sampleData;
        const fileDataWithSource = fileData?.map((row: any) => ({ ...row, source_file: file.name })) || [];

        newFiles.push({
          name: file.name,
          headers: [...data.headers, 'source_file'],
          rowCount: data.rowCount,
          mode: modeToUse as 'mysql' | 'excel',
          data: fileDataWithSource
        });

        totalRows += data.rowCount;
        data.headers.forEach((h: string) => allHeaders.add(h));
        allHeaders.add('source_file');

        if (fileDataWithSource) {
          allData = [...allData, ...fileDataWithSource];
        }
      }

      // Append new files to existing uploaded files
      setUploadedFiles(prev => {
        const updated = [...prev, ...newFiles];

        // Add success message for the current batch
        const fileNames = newFiles.map(f => f.name).join(', ');
        const totalFiles = updated.length;

        // Calculate cumulative data for preview
        const allHeaders = new Set<string>();
        let cumulativeData: any[] = [];
        updated.forEach(f => {
          f.headers.forEach(h => allHeaders.add(h));
          if (f.data) cumulativeData = [...cumulativeData, ...f.data];
        });

        const uploadMessage: Message = {
          id: crypto.randomUUID(),
          content: `✅ Successfully added ${newFiles.length} file(s): ${fileNames}`,
          role: 'assistant',
          timestamp: new Date(),
          type: 'upload',
          data: {
            headers: Array.from(allHeaders),
            data: cumulativeData, // Show full data for preview
            rowCount: updated.reduce((sum, f) => sum + f.rowCount, 0),
            tableName: 'multiple_files'
          }
        };

        setMessages(m => [...m, uploadMessage]);

        if (modeToUse === 'excel') {
          const welcomeMessage: Message = {
            id: crypto.randomUUID(),
            content: `✅ Added ${newFiles.length} file(s). Total files now: ${totalFiles}. Currently loaded: **${updated.map(f => f.name).join(', ')}**. You can ask questions about any of these now!`,
            role: 'assistant',
            timestamp: new Date(),
            type: 'text'
          };
          setMessages(m => [...m, welcomeMessage]);
        }

        return updated;
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: `❌ **Upload Error:** ${error.message || 'An unexpected error occurred during upload. Please check your network or try a different file.'}`,
        role: 'assistant',
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    console.log('🔍 handleAskQuestion called');
    console.log('uploadedFiles:', uploadedFiles);
    console.log('selectedMode:', selectedMode);
    console.log('uploadedFiles[0]?.mode:', uploadedFiles[0]?.mode);
    console.log('Should use Excel API?', uploadedFiles.length > 0 && uploadedFiles[0].mode === 'excel');

    // If in Excel mode and have uploaded files, use Excel query API
    if (uploadedFiles.length > 0 && uploadedFiles[0].mode === 'excel') {
      console.log('✅ Using Excel query API');
      await handleExcelQuestion();
      return;
    }

    // Otherwise use regular chat API
    console.log('❌ Using regular chat API (MySQL)');
    await handleSubmit(e);
  };

  const handleExcelQuestion = async () => {
    if (!inputValue.trim() || uploadedFiles.length === 0) return;

    console.log('🔍 handleExcelQuestion called');
    console.log('Question:', inputValue);

    let combinedData: any[] = [];
    uploadedFiles.forEach(f => {
      if (f.data) {
        combinedData = [...combinedData, ...f.data];
      }
    });

    console.log('Uploaded files data rows total:', combinedData.length);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: inputValue,
      role: "user",
      timestamp: new Date(),
    };

    const userContent = inputValue;
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      console.log('📡 Fetching /api/excel-query...');

      // Increase row limit for query context
      let dataToSend: any[] = [];
      const MAX_ROWS = 2000;

      if (combinedData.length <= MAX_ROWS) {
        dataToSend = combinedData;
      } else {
        const rowsPerFile = Math.floor(MAX_ROWS / uploadedFiles.length);
        uploadedFiles.forEach(f => {
          if (f.data) {
            dataToSend = [...dataToSend, ...f.data.slice(0, rowsPerFile)];
          }
        });
      }

      const response = await fetch("/api/excel-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userContent,
          fileData: dataToSend,
        }),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Result:', result);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: result.response || "Here are your results:",
        role: "assistant",
        timestamp: new Date(),
        type: (result.data && Array.isArray(result.data) && result.data.length > 0) ? "table" : "text",
        data: (result.data && Array.isArray(result.data) && result.data.length > 0)
          ? {
            headers: result.headers || uploadedFiles[0].headers,
            data: result.data,
          }
          : null,
      };

      setMessages((prev) => [...prev, assistantMessage]);

    } catch (error) {
      console.error("💥 Excel Query Error:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: `⚠️ **Analysis Error:** I couldn't process this question right now. Error: ${error instanceof Error ? error.message : String(error)}`,
        role: "assistant",
        timestamp: new Date(),
        type: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQueries = [
    "Show last 5 products",
    "Products with MRP 280",
    "List all categories",
    "Low stock items",
  ];

  const excelQuickQueries = uploadedFiles.length > 0 ? [
    `How many records are there?`,
    `Show first 10 rows`,
    `What's the total?`,
    `Show all columns`,
  ] : [];

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      <div className="flex-1 flex overflow-hidden w-full relative">
        {/* Mobile Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Sidebar */}
        <div className={`
          fixed inset-0 z-40 lg:relative lg:inset-auto 
          w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 
          bg-white dark:bg-gray-900 p-6 
          transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          overflow-y-auto custom-scrollbar
        `}>
          <div className="flex items-center justify-between mb-6 lg:hidden">
            <h2 className="text-xl font-bold">Menu</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">

            {/* Mode Selection */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Database size={16} />
                Select Mode
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedMode('mysql')}
                  className={`w-full p-3 rounded-lg border transition-all duration-200 text-sm font-medium ${selectedMode === 'mysql'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                >
                  🗄️ MySQL Mode
                </button>
                <button
                  onClick={() => setSelectedMode('excel')}
                  className={`w-full p-3 rounded-lg border transition-all duration-200 text-sm font-medium ${selectedMode === 'excel'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-green-200 dark:hover:border-green-800'
                    }`}
                >
                  📊 Excel Analysis Mode
                </button>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Upload size={16} />
                Upload File
              </h3>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={!selectedMode || isUploading}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedMode || isUploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet size={16} />
                      Choose File
                    </>
                  )}
                </button>
                {uploadedFiles.length > 0 && (
                  <div className="mt-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg shadow-sm">
                    <div className="flex items-center gap-2 text-green-800 dark:text-green-200 text-sm font-semibold mb-2">
                      <CheckCircle size={16} />
                      File(s) Successfully Loaded
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-green-700 dark:text-green-300 flex items-start gap-2">
                        <span className="font-medium">📄 File(s):</span>
                        <span className="break-all">{uploadedFiles.map(f => f.name).join(', ')}</span>
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
                        <span className="font-medium">📊 Records:</span>
                        <span>{uploadedFiles.reduce((sum, f) => sum + f.rowCount, 0)} rows total</span>
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-2">
                        <span className="font-medium">🔧 Mode:</span>
                        <span className="font-semibold">{uploadedFiles[0].mode === 'mysql' ? '🗄️ MySQL (Inserted to Database)' : '📊 Excel Analysis (Ask Questions!)'}</span>
                      </div>
                      {uploadedFiles[0].mode === 'excel' && (
                        <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                          <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">💡 Try asking:</p>
                          <div className="flex flex-wrap gap-1">
                            {[
                              "How many records?",
                              "Show first 5",
                              "What's the total?"
                            ].map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => setInputValue(q)}
                                className="px-2 py-1 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded text-xs hover:bg-green-50 dark:hover:bg-green-900/50 transition-colors"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Queries */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Database size={16} />
                {uploadedFiles.length > 0 && uploadedFiles[0].mode === 'excel' ? 'Excel Queries' : 'Quick Queries'}
              </h3>
              <div className="space-y-2">
                {(uploadedFiles.length > 0 && uploadedFiles[0].mode === 'excel' ? excelQuickQueries : quickQueries).map((query, index) => (
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
                {uploadedFiles.length > 0 && uploadedFiles[0].mode === 'excel' ? (
                  <>
                    <li>• Ask "How many records?" for count</li>
                    <li>• Try "Show 2023 data" for filtering</li>
                    <li>• Ask "What's the total?" for sums</li>
                    <li>• Search by keyword or location</li>
                  </>
                ) : (
                  <>
                    <li>• Use natural language queries</li>
                    <li>• Ask for specific filters</li>
                    <li>• Request data in table format</li>
                    <li>• Use "show only" for filtering</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/30 dark:bg-gray-950/30 backdrop-blur-[2px]">
          <div className="flex-1 overflow-y-auto overflow-x-auto p-4 md:p-6 space-y-6 custom-scrollbar w-full">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-full py-10 text-center space-y-8 w-full max-w-5xl mx-auto">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-3xl shadow-2xl">
                  <Bot className="text-white" size={64} />
                </div>
                <div className="space-y-4 max-w-2xl">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-blue-900 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
                    Smart Data Processing Assistant
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    Choose a mode and upload your Excel file to get started
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Database size={16} />
                      🗄️ MySQL Mode
                    </h3>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                        <span>Upload Excel/CSV files to database</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                        <span>Query data using natural language</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mt-1"></div>
                        <span>Prevent duplicate records</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Sparkles size={16} />
                      📊 Excel Analysis Mode
                    </h3>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-1"></div>
                        <span>Analyze Excel files without database</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-1"></div>
                        <span>Ask questions about your data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1"></div>
                        <span>Get counts, sums, averages & more</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 max-w-2xl">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    <Bot size={16} />
                    Getting Started
                  </h4>
                  <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-decimal list-inside">
                    <li>Select either MySQL Mode or Excel Analysis Mode</li>
                    <li>Upload your .xlsx, .xls, or .csv file</li>
                    <li>View your data in table format</li>
                    <li>Ask questions or query your data</li>
                  </ol>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                // Extract suggested questions if this is an assistant message
                const suggestions: string[] = [];
                if (message.role === "assistant") {
                  const suggestionSection = message.content.split(/### (?:🔍 |)Suggested Follow-up Questions/i)[1];
                  if (suggestionSection) {
                    const lines = suggestionSection.split('\n');
                    lines.forEach(line => {
                      const match = line.match(/^\d+\.\s*(.+)$|^\s*-\s*(.+)$|^\s*•\s*(.+)$/);
                      if (match) {
                        const question = (match[1] || match[2] || match[3]).trim();
                        if (question && question.length > 5) suggestions.push(question);
                      }
                    });
                  }
                }

                return (
                  <div
                    key={message.id}
                    className={`flex gap-4 min-w-0 message-bubble-${message.role} ${message.role === "user" ? "justify-end" : "justify-start w-full"
                      }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-200">
                        <Bot size={20} className="text-white" />
                      </div>
                    )}

                    <div className="flex flex-col gap-2 max-w-[90%] md:max-w-[85%]">
                      <div
                        className={`rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 ${message.role === "user"
                          ? "px-6 py-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none shadow-blue-200 dark:shadow-none"
                          : message.type === "error"
                            ? "w-full px-6 py-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
                            : "w-full glass-effect px-6 py-5 border border-gray-100 dark:border-gray-800 rounded-tl-none"
                          }`}
                      >
                        <div className="markdown-content break-words">
                          {(message.type === "data" || message.type === "table" || message.type === "upload") && message.data
                            ? formatDataResponse(message.content, message.data)
                            : (
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h3: ({ children }) => {
                                    const text = String(children);
                                    let icon = <CheckCircle size={18} />;
                                    let className = "header-summary";

                                    if (text.includes("Insight") || text.includes("💡") || text.includes("Key")) {
                                      icon = <Lightbulb size={18} />;
                                      className = "header-insight";
                                    }
                                    if (text.includes("Suggested") || text.includes("🔍") || text.includes("Follow-up")) {
                                      icon = <Search size={18} />;
                                      className = "header-suggested";
                                    }
                                    if (text.includes("Summary") || text.includes("✅")) {
                                      icon = <CheckCircle size={18} />;
                                      className = "header-summary";
                                    }

                                    return (
                                      <h3 className={`flex items-center gap-2 font-bold mb-4 mt-6 ${className}`}>
                                        {icon}
                                        {children}
                                      </h3>
                                    );
                                  }
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            )
                          }
                        </div>

                        <div
                          className={`text-[10px] mt-4 flex items-center gap-2 opacity-60 uppercase tracking-tighter font-semibold ${message.role === "user" ? "text-blue-100" : "text-gray-500"
                            }`}
                        >
                          {message.role === "user" ? <User size={10} /> : <Bot size={10} />}
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {message.type === "data" && (
                            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-[9px]">
                              QUERY RESULT
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Suggestion Buttons */}
                      {suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2 animate-fadeIn">
                          {suggestions.slice(0, 3).map((suggestion, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setInputValue(suggestion);
                                // Optional: auto-submit? Let's keep it to setting input for now
                              }}
                              className="group flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-blue-100 dark:border-blue-900/50 rounded-full text-xs text-blue-700 dark:text-blue-300 transition-all duration-200 hover:shadow-sm"
                            >
                              <MessageSquare size={12} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                              {suggestion}
                              <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-200">
                        <User size={20} className="text-white" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isLoading && (
              <div className="flex gap-4 animate-pulse">
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Bot size={20} className="text-white" />
                </div>
                <div className="glass-effect border border-gray-100 dark:border-gray-800 rounded-2xl px-6 py-5 shadow-sm min-w-[200px]">
                  <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm font-medium">Crunching the data...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6">
            <form onSubmit={handleAskQuestion} className="w-full max-w-5xl mx-auto">
              <div className="flex gap-3 items-end">
                <div className="flex-1 relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl blur opacity-10 group-focus-within:opacity-25 transition-opacity duration-300"></div>
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      uploadedFiles.length > 0 && uploadedFiles[0].mode === 'excel'
                        ? "Ask about your data... (e.g., 'Compare sales across regions')"
                        : "Ask about your data..."
                    }
                    className="w-full relative glass-effect border border-gray-200 dark:border-gray-800 rounded-3xl px-8 py-5 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent dark:text-white resize-none shadow-xl transition-all duration-300 placeholder:text-gray-400"
                    disabled={isLoading || isUploading}
                    rows={1}
                    style={{
                      minHeight: "64px",
                      maxHeight: "200px",
                    }}
                  />
                  <div className="absolute right-6 bottom-5 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isLoading || !inputValue.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl p-2.5 transition-all duration-200 shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center transform hover:scale-105 active:scale-95 transition-all"
                    >
                      {isLoading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Send size={20} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-[11px] text-gray-400 dark:text-gray-500 font-medium tracking-wide uppercase">
                <span className="flex items-center gap-1.5"><Sparkles size={12} /> AI Powered Analysis</span>
                <span className="flex items-center gap-1.5"><Database size={12} /> Secure Data Processing</span>
                <span className="flex items-center gap-1.5"><FileSpreadsheet size={12} /> Professional Reports</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
