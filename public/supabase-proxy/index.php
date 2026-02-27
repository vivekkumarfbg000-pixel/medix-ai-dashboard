<?php
/**
 * Supabase Reverse Proxy for Hostinger Shared Hosting
 *
 * Routes: /supabase-proxy/auth/v1/* → https://ykrqpxbbyfipjqhpaszf.supabase.co/auth/v1/*
 *         /supabase-proxy/rest/v1/* → https://ykrqpxbbyfipjqhpaszf.supabase.co/rest/v1/*
 *         etc.
 *
 * Upload to: public_html/supabase-proxy/index.php
 */
ob_start(); // Prevent accidental whitespace output
define('SUPABASE_TARGET', 'https://ykrqpxbbyfipjqhpaszf.supabase.co');

// ── CORS ──────────────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://medixai.shop', 'https://www.medixai.shop', 'http://localhost:5173', 'http://localhost:8080'];
header('Access-Control-Allow-Origin: ' . (in_array($origin, $allowed) ? $origin : 'https://medixai.shop'));
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, apikey, x-client-info, x-application-name, x-supabase-api-version, range, prefer, x-upsert');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Expose-Headers: Content-Range, X-Supabase-Api-Version, X-Supabase-Auth');
header('Access-Control-Max-Age: 86400');

// Handle OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Build target path ─────────────────────────────────────────────────────────
// On Hostinger, REQUEST_URI could be:
//   /supabase-proxy/auth/v1/token?grant_type=password
//   /supabase-proxy/rest/v1/products
// We strip the /supabase-proxy prefix to get the real path.

$fullUri = $_SERVER['REQUEST_URI'] ?? '/';

// Find and strip the proxy prefix (handle both with and without trailing slash)
$prefixPattern = '#^/supabase-proxy#';
$strippedPath = preg_replace($prefixPattern, '', $fullUri, 1);

// If nothing was stripped or empty, default to /
if ($strippedPath === '' || $strippedPath === false) {
    $strippedPath = '/';
}
// Ensure it starts with /
if ($strippedPath[0] !== '/') {
    $strippedPath = '/' . $strippedPath;
}

$targetUrl = SUPABASE_TARGET . $strippedPath;

// ── Forward headers ───────────────────────────────────────────────────────────
$skipHeaders = ['host', 'connection', 'accept-encoding', 'content-length', 'origin', 'referer'];
$curlHeaders = [];

// Safely get headers (getallheaders is Apache only, might crash on Nginx/FPM)
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                $headers[$headName] = $value;
            } else if ($name == "CONTENT_TYPE") {
                $headers["Content-Type"] = $value;
            } else if ($name == "CONTENT_LENGTH") {
                $headers["Content-Length"] = $value;
            }
        }
        return $headers;
    }
}

foreach (getallheaders() as $name => $value) {
    if (in_array(strtolower($name), $skipHeaders)) continue;
    $curlHeaders[] = "{$name}: {$value}";
}

// ── cURL request ─────────────────────────────────────────────────────────────
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $targetUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,   // Don't follow — we handle responses ourselves
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER     => $curlHeaders,
    CURLOPT_HEADER         => true,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_ENCODING       => '',      // Accept any encoding
]);

$method = strtoupper($_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
    $body = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    // Re-add content-length correctly
    $curlHeaders[] = 'Content-Length: ' . strlen($body);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);
}

$response = curl_exec($ch);

// ── Error handling ────────────────────────────────────────────────────────────
if ($response === false || curl_errno($ch)) {
    $errMsg = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode([
        'error'   => 'proxy_error',
        'message' => $errMsg ?: 'cURL request failed',
        'path'    => $strippedPath,
        'target'  => $targetUrl,
    ]);
    exit;
}

$httpCode    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize  = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
curl_close($ch);

// ── Split & forward response headers ─────────────────────────────────────────
$rawHeaders   = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

$skipRespHeaders = [
    'transfer-encoding', 'connection',
    'access-control-allow-origin', 'access-control-allow-methods',
    'access-control-allow-headers', 'access-control-allow-credentials',
    'access-control-max-age', 'access-control-expose-headers',
];

foreach (explode("\r\n", $rawHeaders) as $line) {
    $line = trim($line);
    if (empty($line) || strpos($line, ':') === false) continue;
    $name = strtolower(substr($line, 0, strpos($line, ':')));
    if (!in_array($name, $skipRespHeaders)) {
        header($line, false);
    }
}

http_response_code($httpCode);
echo $responseBody;
