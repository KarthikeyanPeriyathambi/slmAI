"use client";

import { useState, useEffect } from "react";

export default function MatrixLoading() {
  const [columns, setColumns] = useState<Array<{ id: number; characters: string[] }>>([]);
  
  // Using your app's color scheme - blue and purple instead of green
  const matrixChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  useEffect(() => {
    // Function to create columns of characters
    const createColumns = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const charWidth = 20; // Approximate width of each character
      const charHeight = 20; // Approximate height of each character
      
      const numColumns = Math.ceil(screenWidth / charWidth);
      const numRows = Math.ceil(screenHeight / charHeight) + 5; // Extra rows for continuous effect
      
      const newColumns = [];
      
      for (let i = 0; i < numColumns; i++) {
        const characters = [];
        
        for (let j = 0; j < numRows; j++) {
          characters.push(matrixChars[Math.floor(Math.random() * matrixChars.length)]);
        }
        
        newColumns.push({
          id: i,
          characters
        });
      }
      
      setColumns(newColumns);
    };
    
    // Initial creation
    createColumns();
    
    // Handle window resize
    const handleResize = () => {
      createColumns();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Animation interval
    const interval = setInterval(() => {
      setColumns(prev => {
        return prev.map(col => {
          // Shift characters down and add new random character at the top
          const newChars = [...col.characters];
          newChars.pop();
          newChars.unshift(matrixChars[Math.floor(Math.random() * matrixChars.length)]);
          return { ...col, characters: newChars };
        });
      });
    }, 100);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center z-50 overflow-hidden">
      {/* Matrix background - fills entire screen */}
      <div className="absolute inset-0 flex" style={{ width: '100%', height: '100%' }}>
        {columns.map((column) => (
          <div 
            key={column.id} 
            className="flex flex-col items-center"
            style={{ 
              animation: `fadeInOut ${2 + Math.random() * 3}s infinite`,
              animationDelay: `${Math.random() * 2}s`,
              width: '20px'
            }}
          >
            {column.characters.map((char, index) => (
              <span
                key={`${column.id}-${index}`}
                className="text-blue-400 font-mono text-lg opacity-70"
                style={{
                  textShadow: index === 0 ? "0 0 10px #60a5fa, 0 0 20px #60a5fa" : "none",
                  opacity: index === 0 ? 1 : 0.7 - (index * 0.02),
                  transform: index === 0 ? "scale(1.1)" : "scale(1)",
                  transition: "all 0.1s ease",
                  lineHeight: "1.2"
                }}
              >
                {char}
              </span>
            ))}
          </div>
        ))}
      </div>
      
      {/* Center content */}
      <div className="relative z-10 text-center">
        <div className="mb-8">
          <div className="inline-block animate-pulse">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1 rounded-full">
              <div className="bg-gray-900 rounded-full p-4">
                <div className="w-16 h-16 border-2 border-dashed border-blue-400 rounded-full animate-spin"></div>
              </div>
            </div>
          </div>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            SLM AI PLATFORM
          </span>
        </h1>
        
        <p className="text-blue-300 font-mono text-lg md:text-xl mb-2 animate-pulse">
          Initializing systems...
        </p>
        
        <div className="flex justify-center space-x-2 mt-6">
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
        </div>
      </div>
      
      {/* Custom styles for animations */}
      <style jsx>{`
        @keyframes fadeInOut {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}