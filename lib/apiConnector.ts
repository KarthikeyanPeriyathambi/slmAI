export interface APIConfig {
  id?: number;
  name: string;
  url: string;
  method?: string;
  auth_header?: string;
  description?: string;
}

export interface APIResponse {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
}

/**
 * Generic utility to call external REST APIs
 */
export async function callExternalAPI(config: APIConfig, params: Record<string, any> = {}): Promise<APIResponse> {
  try {
    const { url, method = 'GET', auth_header } = config;
    
    let finalUrl = url;
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add auth header if present
    if (auth_header) {
      const [key, value] = auth_header.split(':').map(s => s.trim());
      if (key && value) {
        (fetchOptions.headers as any)[key] = value;
      } else {
        // Assume it's a Bearer token if no colon
        (fetchOptions.headers as any)['Authorization'] = auth_header.startsWith('Bearer ') 
          ? auth_header 
          : `Bearer ${auth_header}`;
      }
    }

    // Handle GET parameters
    if (method.toUpperCase() === 'GET' && Object.keys(params).length > 0) {
      const urlObj = new URL(url);
      Object.entries(params).forEach(([key, value]) => {
        urlObj.searchParams.append(key, String(value));
      });
      finalUrl = urlObj.toString();
    } 
    // Handle POST/PUT body
    else if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      fetchOptions.body = JSON.stringify(params);
    }

    console.log(`📡 Calling API: ${method} ${finalUrl}`);
    
    const response = await fetch(finalUrl, fetchOptions);
    const status = response.status;
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API returned ${status}: ${errorText}`,
        status
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
      status
    };
  } catch (error: any) {
    console.error('❌ API Connector Error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during API call',
    };
  }
}

/**
 * Normalizes API response for SLM consumption
 * Limits size and extracts key fields if necessary
 */
export function normalizeAPIResponse(data: any): any {
  if (!data) return null;
  
  // If it's an array, limit to first 100 items (or similar reasonable limit for UI)
  if (Array.isArray(data)) {
    return data.slice(0, 100);
  }
  
  // If it's a large object, attempt to find a data array inside it
  if (typeof data === 'object') {
    for (const key in data) {
      if (Array.isArray(data[key])) {
        return { [key]: data[key].slice(0, 100) };
      }
    }
  }
  
  return data;
}
