-- Create api_connectors table
CREATE TABLE IF NOT EXISTS api_connectors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  method VARCHAR(10) DEFAULT 'GET',
  auth_header TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create query_logs table
CREATE TABLE IF NOT EXISTS query_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_role VARCHAR(50),
  question TEXT,
  sql_used TEXT,
  api_called VARCHAR(255),
  response_summary TEXT,
  latency_ms INT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
