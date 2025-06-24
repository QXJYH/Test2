<?php 
header("Content-Type: text/plain");

if (
    (!isset($_GET['placeid']) && !isset($_GET['placeId'])) || 
    !isset($_GET['ticket'])
) {
    exit("placeid and ticket are required");
}

$placeId = isset($_GET['placeid']) ? $_GET['placeid'] : $_GET['placeId'];
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

$launcherResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$launcherError = curl_error($ch);
curl_close($ch);

if ($httpCode == 400) {
    exit("Invalid ticket/Place ID, please try again with a new session, or a valid place ID!");
}

if ($launcherResponse === false) {
    exit("Failed to launch game: " . $launcherError);
}

$launcherData = json_decode($launcherResponse, true);
if (!$launcherData || !isset($launcherData['jobId'], $launcherData['serverPort'])) {
    exit("Invalid PlaceLauncher response: " . htmlspecialchars($launcherResponse));
}

$jobId = $launcherData['jobId'];
$serverPort = $launcherData['serverPort'];

$url = "https://sitetest.zawg.ca/game/get-data?placeid=" . urlencode($placeId);
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Cookie: .ROBLOSECURITY=" . urlencode($ticket),
    "User-Agent: Roblox/WinInet"
]);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);
$error = curl_error($ch);
curl_close($ch);

if ($response === false) {
    exit("failed to get player data - " . $error);
}

$gameData = json_decode($response, true);
if (!$gameData) {
    exit("invalid API response: " . htmlspecialchars($response));
}

if (!isset($gameData['success']) || !$gameData['success']) {
    $errorMsg = $gameData['error'] ?? 'Unknown error';
    exit("API error: $errorMsg");
}

$user = $gameData['user'];
$place = $gameData['place'];

$requireduser = ['userId', 'username', 'accountAgeDays', 'membershipType'];
$requiredplace = ['placeId', 'creatorId', 'creatorType'];
foreach ($requireduser as $field) {
    if (!isset($user[$field])) exit("error: missing user field: $field");
}
foreach ($requiredplace as $field) {
    if (!isset($place[$field])) exit("error: missing place field: $field");
}

function get_signature($script) {
    $keyPath = "./PrivateKey/PrivateKey.pem";
    if (!file_exists($keyPath)) {
        exit("Private key not found!");
    }
    $privateKey = file_get_contents($keyPath);
    if (!$privateKey) {
        exit("Failed to read private key");
    }
    
    $signature = "";
    if (!openssl_sign($script, $signature, $privateKey, OPENSSL_ALGO_SHA1)) {
        exit("Failed to generate sig");
    }
    return base64_encode($signature);
}

$joinscript = [
    "ClientPort" => 0,
    "MachineAddress" => "games.zawg.ca",
    "ServerPort" => (int)$serverPort,
    "PingUrl" => "",
    "PingInterval" => 20,
    "UserName" => $user['username'],
    "SeleniumTestMode" => false,
    "UserId" => (int)$user['userId'],
    "SuperSafeChat" => false,
    "CharacterAppearance" => "http://bs.zawg.ca/Asset/CharacterFetch.ashx?userId=" . $user['userId'],
    "ClientTicket" => "",
    "GameId" => $placeId,
    "PlaceId" => $placeId,
    "MeasurementUrl" => "",
    "WaitingForCharacterGuid" => "26eb3e21-aa80-475b-a777-b43c3ea5f7d2",
    "BaseUrl" => "http://bs.zawg.ca/",
    "ChatStyle" => "ClassicAndBubble",
    "VendorId" => "0",
    "ScreenShotInfo" => "",
    "VideoInfo" => "",
    "CreatorId" => (int)$place['creatorId'],
    "CreatorTypeEnum" => $place['creatorType'],
    "MembershipType" => $user['membershipType'],
    "AccountAge" => (int)$user['accountAgeDays'],
    "CookieStoreFirstTimePlayKey" => "rbx_evt_ftp",
    "CookieStoreFiveMinutePlayKey" => "rbx_evt_fmp",
    "CookieStoreEnabled" => true,
    "IsRobloxPlace" => false,
    "GenerateTeleportJoin" => false,
    "IsUnknownOrUnder13" => false,
    "SessionId" => "39412c34-2f9b-436f-b19d-b8db90c2e186|00000000-0000-0000-0000-000000000000|0|190.23.103.228|8|2021-03-03T17:04:47+01:00|0|null|null",
    "DataCenterId" => 0,
    "UniverseId" => 1,
    "BrowserTrackerId" => 0,
    "UsePortraitMode" => false,
    "FollowUserId" => 0,
    "characterAppearanceId" => 1
];

$data = json_encode($joinscript, JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
$signature = get_signature("\r\n" . $data);
exit("--rbxsig%" . $signature . "%\r\n" . $data);
?>
