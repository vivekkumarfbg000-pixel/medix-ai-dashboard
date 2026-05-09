<?php
/**
 * Supabase PHP Proxy for Hostinger
 * Bypasses ISP blocks in India by proxying requests server-side.
 */

// Allow CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, PATCH, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version, prefer, x-application-name, x-medix-trace");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$supabaseUrl = 'https://ykrqpxbbyfipjqhpaszf.supabase.co';

// Get the requested path
$requestUri = $_SERVER['REQUEST_URI'];
// Remove the /supabase-proxy prefix
$path = preg_replace('/^\/supabase-proxy/', '', $requestUri);

$targetUrl = $supabaseUrl . $path;

// Initialize cURL
$ch = curl_init($targetUrl);

// Forward request method
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);

// Forward headers
$headers = [];
foreach (getallheaders() as $name => $value) {
    $lowerName = strtolower($name);
    // Do not forward host, connection, or content-length to prevent issues
    if ($lowerName !== 'host' && $lowerName !== 'content-length' && $lowerName !== 'connection' && $lowerName !== 'accept-encoding') {
        $headers[] = "$name: $value";
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Forward request body
$input = file_get_contents('php://input');
if (!empty($input)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

// Return the response instead of outputting it directly
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
// Include headers in the output
curl_setopt($ch, CURLOPT_HEADER, true);

// Execute cURL
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Proxy Error', 'message' => curl_error($ch)]);
    curl_close($ch);
    exit();
}

$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

curl_close($ch);

// Set HTTP response code
http_response_code($httpCode);

// Forward response headers
$headersArray = explode("\r\n", $responseHeaders);
foreach ($headersArray as $header) {
    if (!empty($header) && 
        !preg_match('/^Transfer-Encoding:/i', $header) && 
        !preg_match('/^Content-Encoding:/i', $header)) {
        header($header);
    }
}

// Output response body
echo $responseBody;
?>
