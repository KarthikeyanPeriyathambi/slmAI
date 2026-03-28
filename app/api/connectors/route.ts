import { NextRequest } from 'next/server';
import pool from '@/lib/db';

/**
 * Handle API Connectors (CRUD)
 */
export async function GET(request: NextRequest) {
  try {
    const [rows]: any = await pool.query('SELECT * FROM api_connectors WHERE is_active = 1');
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('❌ GET Connectors Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, method = 'GET', auth_header, description } = body;

    if (!name || !url) {
      return new Response(JSON.stringify({ error: 'Name and URL are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const [result]: any = await pool.execute(
      'INSERT INTO api_connectors (name, url, method, auth_header, description) VALUES (?, ?, ?, ?, ?)',
      [name, url, method, auth_header, description]
    );

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.insertId,
      message: 'Connector added successfully' 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('❌ POST Connector Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Soft delete
    await pool.execute('UPDATE api_connectors SET is_active = 0 WHERE id = ?', [id]);

    return new Response(JSON.stringify({ success: true, message: 'Connector deleted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('❌ DELETE Connector Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
