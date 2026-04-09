interface Env {
  ASSETS: {
    fetch: typeof fetch;
  };
  GROQ_SK: string;
  GEMINI_SK: string;
}

// Worker Version: 1.0.8
export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // 0. Handle CORS Preflight for all proxy routes
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
          'X-Worker-Version': '1.0.8',
        },
      });
    }

    // 1. Handle Supabase Proxy
    if (url.pathname.startsWith('/supabase-proxy')) {
      return handleProxy(request, 'https://ykrqpxbbyfipjqhpaszf.supabase.co', '/supabase-proxy');
    }

    // 2. Handle Groq Proxy
    if (url.pathname.startsWith('/groq-proxy')) {
      if (!env.GROQ_SK) {
        return new Response(JSON.stringify({ error: "Configuration Error", message: "GROQ_SK is missing in Cloudflare Dashboard Secrets." }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      return handleProxy(request, 'https://api.groq.com', '/groq-proxy', {
        'Authorization': `Bearer ${env.GROQ_SK.trim()}`
      });
    }

    // 3. Handle Gemini Proxy
    if (url.pathname.startsWith('/gemini-proxy')) {
      if (!env.GEMINI_SK) {
        return new Response(JSON.stringify({ error: "Configuration Error", message: "GEMINI_SK is missing in Cloudflare Dashboard Secrets." }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      return handleProxy(request, 'https://generativelanguage.googleapis.com', '/gemini-proxy', {
        'x-goog-api-key': env.GEMINI_SK.trim()
      });
    }

    // 4. Fallback to static assets (the Dashboard app)
    return env.ASSETS.fetch(request);
  },
};

async function handleProxy(request: Request, targetOrigin: string, pathPrefix: string, injectHeaders: Record<string, string> = {}): Promise<Response> {
  const url = new URL(request.url);
  try {
    const path = url.pathname.replace(pathPrefix, '');
    const targetUrl = `${targetOrigin}${path}${url.search}`;

    // Prepare headers - strip internal Cloudflare headers
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ipcountry');
    headers.delete('cf-ray');
    headers.delete('cf-visitor');
    headers.delete('x-real-ip');

    // Inject secure backend headers
    for (const [key, value] of Object.entries(injectHeaders)) {
      headers.set(key, value);
    }

    // Forward the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.arrayBuffer() 
        : null,
      redirect: 'manual',
    });

    // Add CORS headers for the Mobile App
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    newHeaders.set('X-Worker-Version', '1.0.8');
    newHeaders.set('X-Proxy-Origin', url.hostname);
 
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Proxy Error",
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
