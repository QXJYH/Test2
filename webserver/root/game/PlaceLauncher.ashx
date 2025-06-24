<?php
if (!isset($_GET['ticket']) || empty($_GET['ticket'])) {
    http_response_code(400);
    die("ticket is required");
}

$placeId = null;
foreach ($_GET as $key => $value) {
    if (strtolower($key) === 'placeid') {
        $placeId = $value;
        break;
    }
}

if (empty($placeId)) {
    http_response_code(400);
    die("place ID is required");
}

$ticket = $_GET['ticket'];

$launcherUrl = "https://sitetest.zawg.ca/game/PlaceLauncherBT.ashx?placeId=" . urlencode($placeId);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $launcherUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "btzawgPHPgameserverstart: startgamesessionforthisplace",
    "Cookie: .ROBLOSECURITY=" . urlencode($ticket),
    "User-Agent: Roblox/WinInet"
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);

if (curl_errno($ch)) {
    http_response_code(500);
    die("error: " . curl_error($ch));
}

curl_close($ch);

header('Content-Type: application/json');
echo $response;
?>