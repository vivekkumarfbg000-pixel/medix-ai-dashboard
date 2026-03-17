interface Env {
  ASSETS: {
    fetch: typeof fetch;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Handle Supabase Proxy
    if (url.pathname.startsWith('/supabase-proxy')) {
      try {
        const path = url.pathname.replace('/supabase-proxy', '');
        const targetUrl = `https://ykrqpxbbyfipjqhpaszf.supabase.co${path}${url.search}`;

        // Prepare headers - strip internal Cloudflare headers
        const headers = new Headers(request.headers);
        headers.delete('host');
        headers.delete('cf-connecting-ip');
        headers.delete('cf-ipcountry');
        headers.delete('cf-ray');
        headers.delete('cf-visitor');
        headers.delete('x-real-ip');

        // Forward the request to Supabase
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' 
            ? await request.arrayBuffer() 
            : null,
          redirect: 'follow',
        });

        // Add CORS headers for the Mobile App
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', '*');

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

    // 2. Fallback to static assets (the Dashboard app)
    return env.ASSETS.fetch(request);
  },
};
