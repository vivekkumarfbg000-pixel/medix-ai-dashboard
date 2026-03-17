export const onRequest: PagesFunction = async (context) => {
  try {
    const url = new URL(context.request.url);
    const path = url.pathname.replace('/supabase-proxy', '');
    const search = url.search;
    
    const supabaseUrl = 'https://ykrqpxbbyfipjqhpaszf.supabase.co';
    const targetUrl = `${supabaseUrl}${path}${search}`;
    
    // 1. Prepare headers - carefully strip internal Cloudflare headers
    const headers = new Headers(context.request.headers);
    headers.delete('host');
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ipcountry');
    headers.delete('cf-ray');
    headers.delete('cf-visitor');
    headers.delete('x-real-ip');

    // 2. Clone the request body if present
    let body = null;
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
      body = await context.request.arrayBuffer();
    }

    // 3. Forward the request to Supabase
    const response = await fetch(targetUrl, {
      method: context.request.method,
      headers: headers,
      body: body,
      redirect: 'follow',
    });

    // 4. Return the response as is
    return response;

  } catch (err) {
    // 5. CRITICAL: Always return JSON, even on crash
    // This prevents the SPA "index.html" fallback from confusing the client
    return new Response(
      JSON.stringify({
        error: "Proxy Error",
        message: err instanceof Error ? err.message : String(err),
        suggestion: "Check your internet connection or use a VPN if ISP block persists."
      }),
      { 
        status: 502, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};
