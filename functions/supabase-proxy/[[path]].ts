export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/supabase-proxy', '');
  const search = url.search;
  
  const supabaseUrl = 'https://ykrqpxbbyfipjqhpaszf.supabase.co';
  const targetUrl = `${supabaseUrl}${path}${search}`;
  
  const headers = new Headers(context.request.headers);
  headers.delete('host');

  const modifiedRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: headers,
    body: context.request.method !== 'GET' && context.request.method !== 'HEAD' 
      ? await context.request.arrayBuffer() 
      : null,
    redirect: 'follow',
  });

  return fetch(modifiedRequest);
};
