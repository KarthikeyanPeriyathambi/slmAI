import { NextRequest } from 'next/server';
import { executeQuery, getTables, getTableStructure, getSampleData } from '@/lib/dataAccess';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const table = searchParams.get('table');
    const query = searchParams.get('query');

    switch (action) {
      case 'tables':
        // Get all tables
        const tables = await getTables();
        return new Response(JSON.stringify(tables), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'structure':
        // Get table structure
        if (!table) {
          return new Response(JSON.stringify({ error: 'Table name is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const structure = await getTableStructure(table);
        return new Response(JSON.stringify(structure), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'sample':
        // Get sample data
        if (!table) {
          return new Response(JSON.stringify({ error: 'Table name is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const sample = await getSampleData(table);
        return new Response(JSON.stringify(sample), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'query':
        // Execute custom query
        if (!query) {
          return new Response(JSON.stringify({ error: 'Query is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = await executeQuery(query);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Database API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}