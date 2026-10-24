<?php
// Proxy آمن: يجلب TURN credentials طازة من RStream ويخفي الـ Bearer token عن الواجهة.
// حط التوكن بتاعك في RSTREAM_TOKEN تحت وارفع الملف — الواجهة تنادي api/rstream-turn.php فقط.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

define('RSTREAM_TOKEN', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicGF0IiwidG9rZW5fZW5kcG9pbnQiOiI0ZmU1ZDA5YSIsImlhdCI6MTc4OTc5NzgxOSwianRpIjoiZDlmMmIxNTg0ZDU5ZjRmNTEzNTk1ZjVlMzIxMGUwNTMifQ.5yPY7IXa6Ak4djjimNXXKdXz0Wjn05ScFQDs4ycVDdk');
define('RSTREAM_URL', 'https://rstream.io/api/projects/tunnels/resolve/19fccb1f/turn-server/credentials');

if (RSTREAM_TOKEN === 'PUT_YOUR_RSTREAM_TOKEN_HERE') {
    http_response_code(500);
    echo json_encode(['error' => 'RSTREAM_TOKEN not configured']);
    exit;
}

$ch = curl_init(RSTREAM_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_HTTPHEADER => [
        'authorization: Bearer ' . RSTREAM_TOKEN,
        'content-type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode(['ttlSeconds' => 600]),
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($body === false || $code < 200 || $code >= 300) {
    http_response_code(502);
    echo json_encode(['error' => 'rstream fetch failed', 'http' => $code, 'detail' => $err]);
    exit;
}

// نرجّع رد RStream كما هو (username/credential/urls/ttl)
echo $body;
