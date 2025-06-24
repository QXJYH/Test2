local jobId = "InsertJobIdHere";
local assetId = 65789275746246;
local assetType = 358843;
local mode = "R6";
local baseURL = "https://bs.zawg.ca";
local goToAsset = "/asset/?id="
local uploadURL = "http://localhost:3040/api/upload-thumbnail-v1"; -- Changed to your endpoint
local TIMEOUT = 15

local ScriptContext = game:GetService("ScriptContext");
local Lighting = game:GetService('Lighting');
local RunService = game:GetService('RunService');
local ContentProvider = game:GetService('ContentProvider');
local HttpService = game:GetService("HttpService");
local ThumbnailGenerator = game:GetService('ThumbnailGenerator');
local Players = game:GetService("Players");
local Insert = game:GetService("InsertService");

game:GetService('StarterGui'):SetCoreGuiEnabled(Enum.CoreGuiType.All, false);
ThumbnailGenerator.GraphicsMode = 2;
HttpService.HttpEnabled = true;
ScriptContext.ScriptsDisabled = true;
Lighting.Outlines = false;

ContentProvider:SetBaseUrl(baseURL);
ContentProvider:SetAssetUrl(baseURL);
Insert:SetAssetUrl(baseURL .. "/asset/?id=%d");
Insert:SetAssetVersionUrl(baseURL .. "/Asset/?assetversionid=%d");
Players:SetChatFilterUrl(baseURL .. "/Game/ChatFilter.ashx");

local function withTimeout(promise, timeout, taskName)
    local start = os.time()
    local result, err

    local thread = coroutine.create(function()
        result = {pcall(promise)}
    end)
    
    coroutine.resume(thread)

    while coroutine.status(thread) ~= "dead" do
        if os.time() - start >= timeout then
            print("[timeout] Task timed out:", taskName)
            return false, "Timeout after "..timeout.." seconds"
        end
        wait(0.1)
    end
    
    return unpack(result or {false, "Unknown error"})
end

local function render(id)
    print("[debug] render function called with assetId:", assetId, "and assetType:", assetType)

    local assetUrl = baseURL .. goToAsset .. assetId;

    if assetType == 18 then
        print("[debug] assetType is 18, proceeding with asset loading")
        local ok, asset = withTimeout(function()
            return Insert:LoadAsset(assetId)
        end, TIMEOUT, "LoadAsset")
        
        if ok and asset then
            local image = asset:GetChildren()[1]
            
            if image.ClassName == "Decal" then
                assetUrl = image.Texture
            else
                for _, item in pairs(image:GetChildren()) do
                    if item.ClassName == "Decal" then
                        assetUrl = item.Texture
                        print("[debug] found decal in child, updating to:", assetUrl)
                        break
                    end
                end
            end
        else
            print("[debug] load failed, error:", asset)
        end
    end

    local ok, avatarEncoded = withTimeout(function()
        return ThumbnailGenerator:ClickTexture(assetUrl, 'png', 420, 420)
    end, TIMEOUT, "ClickTexture")

    if not ok then
        print("[error] generation failed:", avatarEncoded)
        return false
    end

    print("[debug] POST to upload URL:", uploadURL)
    local ok, data = withTimeout(function()
        return HttpService:PostAsync(
            uploadURL, 
            HttpService:JSONEncode({
                ['thumbnail'] = avatarEncoded,
                ['assetId'] = assetId,
                ['accessKey'] = "AccessKey",
                ['type'] = "Image",
                ['jobId'] = jobId,
            }), 
            Enum.HttpContentType.TextPlain
        )
    end, TIMEOUT, "HTTP Post")

    if ok then
        print("[debug] POST request successful, response data:", data)
        return true
    else
        print("[debug] POST request failed, error:", data)
        return false
    end
end

local success = render(assetId)

print("[debug] cleaning up...")
game:GetService("RunService"):Stop()