export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const path = url.pathname.replace('/supabase-proxy', '');
  const search = url.search;
  
  const supabaseUrl = 'https://ykrqpxbbyfipjqhpaszf.supabase.co';
  const targetUrl = `${supabaseUrl}${path}${search}`;
  
  const modifiedRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
    redirect: 'follow',
  });

  return fetch(modifiedRequest);
};
