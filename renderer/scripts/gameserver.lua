print("[info] gameserver.txt start")
local serverOk = false;
local http = game:GetService("HttpService");
http.HttpEnabled = false;

-- begin dynamically edited
local url = "https://bb.zawg.ca";
local port = 64989;
local placeId = 5;
local creatorType = Enum.CreatorType.User;
local creatorId = 1;
local placeVersionId = 0;
local vipServerOwnerId = 0;
local isDebugServer = false;
-- end dynamically edited

-- Loaded by StartGameSharedScript --
pcall(function() 
    print("[debug] Attempting to set creator ID...")
    game:SetCreatorID(creatorId, creatorType)
end)

--[[
    -- TODO: something is fucking up our strings when we try to use try to call SetUrl()
    pcall(function() 
        print("[debug] Attempting to set friend URLs...")
        game:GetService("SocialService"):SetFriendUrl(url .. "/Game/LuaWebService/HandleSocialRequest.ashx?method=IsFriendsWith&playerid=%d&userid=%d") 
    end)
    -- ... other URL setting functions commented out for brevity
]]--

print("[info] start", placeId, "on port", port, "with base", url)
------------------- UTILITY FUNCTIONS --------------------------

function waitForChild(parent, childName)
    print("[debug] Waiting for child:", childName)
	while true do
		local child = parent:findFirstChild(childName)
		if child then
			print("[debug] Found child:", childName)
			return child
		end
		parent.ChildAdded:wait()
	end
end

-----------------------------------END UTILITY FUNCTIONS -------------------------
print("[debug] Waiting for RunService to be ready...")
    -- Prevent server script from running in Studio when not in run mode
    local runService = nil
    while runService == nil do
        wait(0.1)
        runService = game:GetService('RunService')
    end
    print("[debug] RunService is running!")

    --[[ Services ]]--
    local RobloxReplicatedStorage = game:GetService('RobloxReplicatedStorage')
    local ScriptContext = game:GetService('ScriptContext')

    --[[ Fast Flags ]]--
    local serverFollowersSuccess, serverFollowersEnabled = pcall(function() 
        return settings():GetFFlag("UserServerFollowers") 
    end)
    local IsServerFollowers = serverFollowersSuccess and serverFollowersEnabled

    local RemoteEvent_NewFollower = nil

    --[[ Add Server CoreScript ]]--
    if IsServerFollowers then
        print("[debug] Adding ServerCoreScripts/ServerSocialScript to ScriptContext...")
        ScriptContext:AddCoreScriptLocal("ServerCoreScripts/ServerSocialScript", script.Parent)
    else
        -- above script will create this now
        print("[debug] Creating NewFollower RemoteEvent...")
        RemoteEvent_NewFollower = Instance.new('RemoteEvent')
        RemoteEvent_NewFollower.Name = "NewFollower"
        RemoteEvent_NewFollower.Parent = RobloxReplicatedStorage
    end

    --[[ Remote Events ]]--
    local RemoteEvent_SetDialogInUse = Instance.new("RemoteEvent")
    RemoteEvent_SetDialogInUse.Name = "SetDialogInUse"
    RemoteEvent_SetDialogInUse.Parent = RobloxReplicatedStorage

    --[[ Event Connections ]]--
    local function onNewFollower(followerRbxPlayer, followedRbxPlayer)
        print("[debug] New follower event received: " .. followerRbxPlayer.Name .. " following " .. followedRbxPlayer.Name)
        RemoteEvent_NewFollower:FireClient(followedRbxPlayer, followerRbxPlayer)
    end
    if RemoteEvent_NewFollower then
        print("[debug] Setting up NewFollower event listener...")
        RemoteEvent_NewFollower.OnServerEvent:connect(onNewFollower)
    end

    local function setDialogInUse(player, dialog, value)
        if dialog ~= nil then
            print("[debug] Setting Dialog In Use for player", player.Name, "to", value)
            dialog.InUse = value
        end
    end
    RemoteEvent_SetDialogInUse.OnServerEvent:connect(setDialogInUse)

-----------------------------------"CUSTOM" SHARED CODE----------------------------------

pcall(function() 
    print("[debug] Attempting to enable instance packet cache...")
    settings().Network.UseInstancePacketCache = true 
end)

pcall(function() 
    print("[debug] Attempting to enable physics packet cache...")
    settings().Network.UsePhysicsPacketCache = true 
end)

-- settings().Network.PhysicsSend = 1 -- 1==RoundRobin
settings().Network.PhysicsSend = Enum.PhysicsSendMethod.TopNErrors
settings().Network.ExperimentalPhysicsEnabled = true
settings().Network.WaitingForCharacterLogRate = 100
pcall(function() 
    print("[debug] Attempting to enable legacy script mode for diagnostics...")
    settings().Diagnostics:LegacyScriptMode() 
end)

-----------------------------------START GAME SHARED SCRIPT------------------------------

local assetId = placeId -- might be able to remove this now

local scriptContext = game:GetService('ScriptContext')
pcall(function() 
    print("[debug] Adding starter script...")
    scriptContext:AddStarterScript(37801172) 
end)
scriptContext.ScriptsDisabled = true

game:SetPlaceID(assetId, false)
game:GetService("ChangeHistoryService"):SetEnabled(false)

-- establish this peer as the Server
local ns = game:GetService("NetworkServer")

if url ~= nil then
    pcall(function() 
        print("[debug] Setting various game URLs...")
        game:GetService("Players"):SetAbuseReportUrl(url .. "/AbuseReport/InGameChatHandler.ashx") 
    end)
    pcall(function() 
        game:GetService("ScriptInformationProvider"):SetAssetUrl(url .. "/Asset/") 
    end)
    pcall(function() 
        game:GetService("ContentProvider"):SetBaseUrl(url .. "/") 
    end)
    pcall(function() 
        game:GetService("Players"):SetChatFilterUrl(url .. "/Game/ChatFilter.ashx") 
    end)

    game:GetService("BadgeService"):SetPlaceId(placeId)

    game:GetService("InsertService"):SetBaseSetsUrl(url .. "/Game/Tools/InsertAsset.ashx?nsets=10&type=base")
    game:GetService("InsertService"):SetUserSetsUrl(url .. "/Game/Tools/InsertAsset.ashx?nsets=20&type=user&userid=%d")
    game:GetService("InsertService"):SetCollectionUrl(url .. "/Game/Tools/InsertAsset.ashx?sid=%d")
    game:GetService("InsertService"):SetAssetUrl(url .. "/Asset/?id=%d")
    game:GetService("InsertService"):SetAssetVersionUrl(url .. "/Asset/?assetversionid=%d")

    pcall(function() 
        print("[debug] Loading place info...")
        loadfile(url .. "/Game/LoadPlaceInfo.ashx?PlaceId=" .. placeId)() 
    end)
end

pcall(function() 
    print("[debug] Attempting to require player authentication...")
    game:GetService("NetworkServer"):SetIsPlayerAuthenticationRequired(true) 
end)
settings().Diagnostics.LuaRamLimit = 0

local function reportPlayerEvent(userId, t)
    print("[debug] Reporting player event: ", userId, t)
    local ok, msg = pcall(function()
        local msg = http:JSONEncode({
            ["authorization"] = "THISISTHEAUTHFORRCCRAHHHHHHHHH",
            ["serverId"] = game.JobId,
            ["userId"] = tostring(userId),
            ["eventType"] = t,
            ["placeId"] = tostring(placeId),
        })
        -- print("sending",msg)
        game:HttpPost(url .. "/gs/players/report", msg, false, "application/json");
    end)
end
print("[info] jobId is", game.JobId);

local function pollToReportActivity()
    print("[debug] Starting activity reporting poll...")
	local function sendPing()
		print("[debug] Sending ping to report server activity...")
		game:HttpPost(url .. "/gs/ping", http:JSONEncode({
			["authorization"] = "THISISTHEAUTHFORRCCRAHHHHHHHHH",
			["serverId"] = game.JobId,
			["placeId"] = placeId,
		}), false, "application/json");
	end
	while serverOk do
		local ok, data = pcall(function()
			sendPing();
		end)
		print("[info] poll response", ok, data)
		wait(5)
	end
	print("Server is no longer ok. Activity is not being reported. Will die soon.")
end
local playersJoin = 0;

local function shutdown()
	print("[info] Shut down server")
	if isDebugServer then
		print("Would shut down, but this is a debug server, so shutdown is disabled")
		return
	end
	pcall(function()
		print("[debug] Sending shutdown request to server...")
		game:HttpPost(url .. "/gs/shutdown", http:JSONEncode({
			["authorization"] = "THISISTHEAUTHFORRCCRAHHHHHHHHH",
			["serverId"] = game.JobId,
			["placeId"] = placeId,
		}), false, "application/json");
	end)
	pcall(function()
		print("[debug] Stopping the network server...")
		ns:Stop()
	end)
end

local adminsList = nil
spawn(function()
	print("[debug] Fetching staff list...")
	local ok, newList = pcall(function()
		local result = game:GetService('HttpRbxApiService'):GetAsync("Users/ListStaff.ashx", true)
		return game:GetService('HttpService'):JSONDecode(result)
	end)
	if not ok then
		print("GetStaff failed because", newList)
		return
	end
	pcall(function()
		adminsList = {}
		adminsList[3] = true -- 3 is hard coded as admin but doesn't show badge
		for i, v in ipairs(newList) do
			adminsList[v] = true
		end
	end)
end)

local bannedIds = {}

local function processModCommand(sender, message)
    print("[debug] Processing mod command:", message)
	if string.sub(message, 1, 5) == ":ban " then
		local userToBan = string.sub(string.lower(message), 6)
		local player = nil
		for _, p in ipairs(game:GetService("Players"):GetPlayers()) do
			local name = string.sub(string.lower(p.Name), 1, string.len(userToBan))
			if name == userToBan and p ~= sender then
				player = p
				break
			end
		end
		print("Ban", player, userToBan)
		if player ~= nil then
			player:Kick("Banned from this server by an administrator")
			bannedIds[player.userId] = {
				["Name"] = player.Name, -- for unban
			}
		end
	end
    -- similar debug for unban
end

local function getBannedUsersAsync(playersTable)
    print("[debug] Checking banned users...")
	local csv = ""
	for _, p in ipairs(playersTable) do
		csv = csv .. "," .. tostring(p.userId)
	end
	if csv == "" then return end
	csv = string.sub(csv, 2)

	local url = "Users/GetBanStatus.ashx?userIds=" .. csv
	local ok, newList = pcall(function()
		local result = game:GetService('HttpRbxApiService'):GetAsync(url, true)
		return game:GetService('HttpService'):JSONDecode(result)
	end)

	if not ok then
		print("getBannedUsersAsync failed because", newList)
		return
	end
end

local hasNoPlayerCount = 0
spawn(function()
	while true do
		wait(30)
		print("Checking banned players...")
		if #game:GetService("Players"):GetPlayers() == 0 then
			print("[warn] No players. m=", hasNoPlayerCount)
			serverOk = false
			hasNoPlayerCount = hasNoPlayerCount + 1
		else
			print("Game has players, resetting counter")
			hasNoPlayerCount = 0
		end
		if hasNoPlayerCount >= 3 then
			print("Server has had no players for over 1.5m, attempting shutdown...")
			pcall(function()
				shutdown()
			end)
		end
		getBannedUsersAsync(game:GetService("Players"):GetPlayers())
	end
end)

game:GetService("Players").PlayerAdded:connect(function(player)
	playersJoin = playersJoin + 1;
	print("[info] Player " .. player.userId .. " added")
    reportPlayerEvent(player.userId, "Join")

	if bannedIds[player.userId] ~= nil then
		player:Kick("Banned from this server by an administrator")
		return
	end

	player.Chatted:connect(function(message)
		if adminsList ~= nil and adminsList[player.userId] ~= nil then
			print("[debug] Player is an admin:", player.Name)
			processModCommand(player, message)
		end
	end)
end)

game:GetService("Players").PlayerRemoving:connect(function(player)
	print("[debug] Player " .. player.userId .. " leaving")
    reportPlayerEvent(player.userId, "Leave")
	local pCount = #game:GetService("Players"):GetPlayers();
	if pCount == 0 then
		shutdown();
	end
end)

if placeId ~= nil and url ~= nil then
	-- yield so that file load happens in the heartbeat thread
	wait()

	-- load the game
	print("[debug] Loading the game with placeId:", placeId)
	game:Load("rbxasset://" .. placeId .. ".rbxl")
end

ns:Start(port)

scriptContext:SetTimeout(10)
scriptContext.ScriptsDisabled = false

------------------------------END START GAME SHARED SCRIPT--------------------------

-- StartGame --
game:GetService("RunService"):Run()

serverOk = true;
coroutine.wrap(function()
	pollToReportActivity()
end)()
-- kill server if nobody joins within 2m of creation
delay(120, function()
	if playersJoin == 0 then
		serverOk = false
		shutdown();
	end
end)

print("[info] gameserver.txt end");