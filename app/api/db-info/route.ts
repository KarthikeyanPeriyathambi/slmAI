import { NextRequest } from 'next/server';
import { executeQuery } from '@/lib/dataAccess';

export async function GET(request: NextRequest) {
  try {
    // Get basic database info
    const dbInfo = {
      name: process.env.DB_NAME || 'Not configured',
      host: process.env.DB_HOST || 'Not configured',
      port: process.env.DB_PORT || 'Not configured'
    };

    // Try to get table count if database is connected
    let tableCount = 0;
    let isConnected = false;
    
    try {
      const tables = await executeQuery('SHOW TABLES');
      tableCount = Array.isArray(tables) ? tables.length : 0;
      isConnected = true;
    } catch (error) {
      // Database not connected
      console.log('Database not connected yet');
    }

    return new Response(JSON.stringify({
      dbInfo,
      isConnected,
      tableCount
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database info API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}