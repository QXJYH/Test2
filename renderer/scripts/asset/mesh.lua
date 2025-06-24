local assetId = {1234};
local jobId = "InsertJobIdHere";
local mode = "R6";
local baseURL = "http://bs.zawg.ca";
local uploadURL = "UPLOAD_URL_HERE";
local _X_RES_ = 512;
local _Y_RES_ = 512;

print("[DEBUG] Initializing services...")
local ScriptContext = game:GetService("ScriptContext");
local Lighting = game:GetService('Lighting');
local RunService = game:GetService('RunService');
local ContentProvider = game:GetService('ContentProvider');
local HttpService = game:GetService("HttpService");
local ThumbnailGenerator = game:GetService('ThumbnailGenerator');
local Players = game:GetService("Players");

print("[DEBUG] Configuring services...")
game:GetService('StarterGui'):SetCoreGuiEnabled(Enum.CoreGuiType.All, false);
print("[DEBUG] Core GUI disabled")
game:GetService('ThumbnailGenerator').GraphicsMode = 2;
print("[DEBUG] ThumbnailGenerator GraphicsMode set to 2")
HttpService.HttpEnabled = true;
print("[DEBUG] HttpEnabled set to true")
ScriptContext.ScriptsDisabled = true
print("[DEBUG] ScriptsDisabled set to true")
Lighting.Outlines = false
print("[DEBUG] Lighting outlines disabled")

-- URL setup
print("[DEBUG] Setting up URLs...")
ContentProvider:SetBaseUrl('https://bs.zawg.ca')
print("[DEBUG] Base URL set to:", ContentProvider.BaseUrl)
game:GetService("ContentProvider"):SetAssetUrl(baseURL .. "/asset/")
print("[DEBUG] Asset URL set")
game:GetService("InsertService"):SetAssetUrl(baseURL .. "/asset/?id=%d")
print("[DEBUG] InsertService Asset URL set")
pcall(function() game:GetService("ScriptInformationProvider"):SetAssetUrl(baseURL .. "/asset/") end)
print("[DEBUG] ScriptInformationProvider attempt set")
Players:SetChatFilterUrl(baseURL .. "/Game/ChatFilter.ashx")
print("[DEBUG] Chat filter URL set")
game:GetService("InsertService"):SetAssetVersionUrl(baseURL .. "/asset/?assetversionid=%d")
print("[DEBUG] Asset version URL set")

local function concat(one, two, three)
    print("[DEBUG] Concatenating strings:", one, two, three)
    return one .. two .. three
end

local function render()
    print("[DEBUG] Render function started")
    
    -- Create mesh part
    print("[DEBUG] Creating MeshPartContainer")
    local MeshPartContainer = Instance.new("Part");
    local currentAssetId = assetId[1];
    print("[DEBUG] Using asset ID:", currentAssetId)
    
    -- Create file mesh
    print("[DEBUG] Creating FileMesh")
    local renderMeshExample = Instance.new("FileMesh", MeshPartContainer);
    local meshUrl = concat(baseURL, "/asset/?id=", tostring(currentAssetId));
    renderMeshExample.MeshId = meshUrl;
    print("[DEBUG] Mesh ID set to:", meshUrl)
    
    -- Create model in workspace
    print("[DEBUG] Creating character model in workspace")
    local charModel = Instance.new("Model", game.Workspace);
    MeshPartContainer.Parent = charModel;
    print("[DEBUG] MeshPartContainer parent set to charModel")

    print("[DEBUG] Waiting 4 seconds for asset to load...")
    wait(4)
    
    -- Generate thumbnail
    print("[DEBUG] Generating thumbnail")
    local encoded, errorMessage = pcall(function()
        return ThumbnailGenerator:Click('png', _X_RES_, _Y_RES_, true, false)
    end)
    
    if not encoded then
        print("[ERROR] Thumbnail generation failed:", errorMessage)
        return
    end
    
    print("[DEBUG] Thumbnail generated successfully")
    print("[DEBUG] Sending POST request with thumbnail data")

    -- Send HTTP request
    local ok, data = pcall(function()
        local postData = {
            ['type'] = 'Asset',
            ['assetId'] = currentAssetId,
            ['thumbnail'] = encoded,
            ['accessKey'] = "AccessKey",
            ['jobId'] = jobId,
        }
        print("[DEBUG] POST data prepared:", HttpService:JSONEncode(postData))
        return HttpService:PostAsync(uploadURL, HttpService:JSONEncode(postData), Enum.HttpContentType.TextPlain)
    end)
    
    print("[DEBUG] POST request completed - Success:", ok)
    if not ok then
        print("[ERROR] POST request failed:", data)
    else
        print("[DEBUG] POST response:", data)
    end
end

-- Main execution
print("[DEBUG] Starting render process")
local ok, err = pcall(render)
if not ok then
    print("[ERROR] Render process failed:", err)
    print(debug.traceback())
else
    print("[DEBUG] Render process completed successfully")
end

print("[DEBUG] Script execution complete")