"use client";

import { useState, useEffect } from "react";
import ChatInterface from "./components/ChatInterface";
import MatrixLoading from "./components/MatrixLoading";

export default function Home() {
  const [dbInfo, setDbInfo] = useState({
    isConnected: false,
    tableCount: 0,
    name: ""
  });
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Simulate initialization delay for matrix effect
    const initTimer = setTimeout(() => {
      setInitializing(false);
    }, 2000); // Show matrix loading for 2 seconds

    // Fetch database info
    const fetchDbInfo = async () => {
      try {
        const response = await fetch('/api/db-info');
        if (response.ok) {
          const data = await response.json();
          setDbInfo(data);
        }
      } catch (error) {
        console.error('Error fetching database info:', error);
      } finally {
        setLoading(false);
      }
    };

    // Start fetching DB info immediately
    fetchDbInfo();
    
    return () => clearTimeout(initTimer);
  }, []);

  // Show matrix loading screen during initialization
  if (initializing) {
    return <MatrixLoading />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900">
      {/* Enhanced Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-[80%] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-xl">
                <span className="text-white text-lg">🚀</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SLM AI Platform
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Intelligent Database Assistant
                </p>
              </div>
            </div>
            
            {/* Database Status */}
            <div className="flex items-center space-x-4">
              {loading ? (
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Checking database...</span>
                </div>
              ) : dbInfo.isConnected ? (
                <div className="flex items-center space-x-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-full px-4 py-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="text-sm">
                    <span className="text-green-700 dark:text-green-300 font-medium">Connected</span>
                    <span className="text-green-600 dark:text-green-400 ml-2">
                      {dbInfo.name} • {dbInfo.tableCount} tables
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-full px-4 py-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                    Database not connected
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Prevent auto-scrolling */}
      <main className="flex-1">
        <div className="h-full">
          <ChatInterface />
        </div>
      </main>

      {/* Enhanced Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6 text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                System Online
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                AI Ready
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Database Active
              </span>
            </div>
            
            <div className="text-right">
              <p className="text-gray-600 dark:text-gray-400">
                Powered by <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SLM AI Technology</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Secure • Fast • Intelligent
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}