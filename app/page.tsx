"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ChatInterface from "./components/ChatInterface";

export default function Home() {
  const [dbInfo, setDbInfo] = useState({
    isConnected: false,
    tableCount: 0,
    name: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchDbInfo();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-gray-200 dark:border-gray-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">SLM Chat</h1>
          <div className="flex items-center space-x-4">
            {loading ? (
              <span className="text-sm text-gray-600 dark:text-gray-400">Checking database...</span>
            ) : dbInfo.isConnected ? (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Database: {dbInfo.name} ({dbInfo.tableCount} tables)
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Database not connected
                </span>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <ChatInterface />
      </main>
      <footer className="border-t border-gray-200 dark:border-gray-800 p-4 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>Powered by SLM AI Technology</p>
      </footer>
    </div>
  );
}