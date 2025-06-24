using System.ComponentModel.DataAnnotations;
using System.Dynamic;
using System.Security.Cryptography;
using System.Text;
using System.Web;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.Net.Http.Headers;
using Newtonsoft.Json;
using System.Collections.Concurrent;
using System.Diagnostics;
using Roblox.Dto.Games;
using Roblox.Dto.Persistence;
using Roblox.Dto.Users;
using MVC = Microsoft.AspNetCore.Mvc;
using Roblox.Libraries.Assets;
using Roblox.Libraries.FastFlag;
using Roblox.Libraries.RobloxApi;
using Roblox.Logging;
using Roblox.Services.Exceptions;
using BadRequestException = Roblox.Exceptions.BadRequestException;
using Roblox.Models.Assets;
using Roblox.Models.GameServer;
using Roblox.Models.Users;
using Roblox.Services;
using Roblox.Services.App.FeatureFlags;
using Roblox.Website.Controllers.Internal;
using Roblox.Website.Filters;
using Roblox.Website.Middleware;
using Roblox.Website.WebsiteModels.Asset;
using Roblox.Website.WebsiteModels.Games;
using Roblox.Website.WebsiteModels.Promocodes;
using Roblox.Website.WebsiteModels.Discord;
using HttpGet = Roblox.Website.Controllers.HttpGetBypassAttribute;
using JsonSerializer = System.Text.Json.JsonSerializer;
using MultiGetEntry = Roblox.Dto.Assets.MultiGetEntry;
using SameSiteMode = Microsoft.AspNetCore.Http.SameSiteMode;
using ServiceProvider = Roblox.Services.ServiceProvider;
using Type = Roblox.Models.Assets.Type;
using System.Data;
using Npgsql;
using Dapper;

namespace Roblox.Website.Controllers
{
    [MVC.ApiController]
    [MVC.Route("/")]
    public class BypassController : ControllerBase
    {
        [HttpGet("internal/release-metadata")]
        public dynamic GetReleaseMetaData([Required] string requester)
        {
            throw new RobloxException(RobloxException.BadRequest, 0, "BadRequest");
        }

        [HttpGet("asset/shader")]
        public async Task<MVC.FileResult> GetShaderAsset(long id)
        {
            var isMaterialOrShader = BypassControllerMetadata.materialAndShaderAssetIds.Contains(id);
            if (!isMaterialOrShader)
            {
                // Would redirect but that could lead to infinite loop.
                // Just throw instead
                throw new RobloxException(400, 0, "Material/Shader");
            }

            var assetId = id;
            try
            {
                var ourId = await services.assets.GetAssetIdFromRobloxAssetId(assetId);
                assetId = ourId;
            }
            catch (RecordNotFoundException)
            {
                // Doesn't exist yet, so create it
                var migrationResult = await MigrateItem.MigrateItemFromRoblox(assetId.ToString(), false, null, default, new ProductDataResponse()
                {
                    Name = "ShaderConversion" + id,
                    AssetTypeId = Type.Special, // Image
                    Created = DateTime.UtcNow,
                    Updated = DateTime.UtcNow,
                    Description = "ShaderConversion1.0",
                });
                assetId = migrationResult.assetId;
            }
            
            var latestVersion = await services.assets.GetLatestAssetVersion(assetId);
            if (latestVersion.contentUrl is null)
            {
                throw new RobloxException(403, 0, "Forbidden"); // ?
            }
            // These files are large, encourage clients to cache them
            HttpContext.Response.Headers.CacheControl = new CacheControlHeaderValue()
            {
                Public = true,
                MaxAge = TimeSpan.FromDays(360),
            }.ToString();
            var assetContent = await services.assets.GetAssetContent(latestVersion.contentUrl);
            return File(assetContent, "application/binary");
        }

        private bool IsRcc()
        {
            var rccAccessKey = Request.Headers.ContainsKey("accesskey") ? Request.Headers["accesskey"].ToString() : null;
            var isRcc = rccAccessKey == Configuration.RccAuthorization;
            return isRcc;
        }
				
		[HttpGetBypass("game/players/{userId}")]
		public dynamic GetPlayerChatFilter(long userId)
		{
			return new
			{
				ChatFilter = "whitelist"
			};
		}
		
		private static bool IsHeaderBlacklisted(string headerName)
		{
			var blacklistedHeaders = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
			{
				"Transfer-Encoding",
				"Connection",
				"Keep-Alive",
				"Content-Length",
				"Upgrade",
				"Server"
			};
			
			return blacklistedHeaders.Contains(headerName);
		}

        [HttpGet("asset")]
        public async Task<MVC.ActionResult> GetAssetById(long id)
        {
            // TODO: This endpoint needs to be updated to return a URL to the asset, not the asset itself.
            // The reason for this is so that cloudflare can cache assets without caching the Response of this endpoint, which might be different depending on the client making the request (e.g. under 18 user, over 18 user, rcc, etc).
            var is18OrOver = false;
            if (userSession != null)
            {
                is18OrOver = await services.users.Is18Plus(userSession.userId);
            }

            // TEMPORARY UNTIL AUTH WORKS ON STUDIO! REMEMBER TO REMOVE
            if (HttpContext.Request.Headers.ContainsKey("RbxTempBypassFor18PlusAssets"))
            {
                is18OrOver = true;
            }
            
            var assetId = id;
            var invalidIdKey = "InvalidAssetIdForConversionV1:" + assetId;
            // Opt
            if (Services.Cache.distributed.StringGetMemory(invalidIdKey) != null)
                throw new RobloxException(400, 0, "Asset is invalid or does not exist");
            
            var isBotRequest = Request.Headers["bot-auth"].ToString() == Roblox.Configuration.BotAuthorization;
            var isLoggedIn = userSession != null;
            var encryptionEnabled = !isBotRequest; // bots can't handle encryption :(
#if DEBUG == false
            var userAgent = Request.Headers["User-Agent"].FirstOrDefault()?.ToLower();
            var requester = Request.Headers["Requester"].FirstOrDefault()?.ToLower();
            if (!isBotRequest && !isLoggedIn) {
                if (userAgent is null) throw new BadRequestException();
                if (requester is null) throw new BadRequestException();
                // Client = studio/client, Server = rcc
                if (requester != "client" && requester != "server")
                {
                    throw new BadRequestException();
                }

                if (!BypassControllerMetadata.allowedUserAgents.Contains(userAgent))
                {
                    throw new BadRequestException();
                }
            }
#endif

            var isMaterialOrShader = BypassControllerMetadata.materialAndShaderAssetIds.Contains(assetId);
            if (isMaterialOrShader)
            {
                return new MVC.RedirectResult("/asset/shader?id=" + assetId);
            }

            var isRcc = IsRcc();
            if (isRcc)
                encryptionEnabled = false;
#if DEBUG
            encryptionEnabled = false;
#endif
            MultiGetEntry details;
			try
				{
					details = await services.assets.GetAssetCatalogInfo(assetId);
				}
				catch (RecordNotFoundException)
				{
					try
					{
						var ourId = await services.assets.GetAssetIdFromRobloxAssetId(assetId);
						assetId = ourId;
					}
					catch (RecordNotFoundException)
					{		
						var pxyurl = $"https://bt.zawg.ca/asset/roblox/?id={assetId}";

						using var httpClient = new HttpClient();
						httpClient.Timeout = TimeSpan.FromSeconds(10);
						
						try
						{
							var stopwatch = Stopwatch.StartNew();
							
							var response = await httpClient.GetAsync(pxyurl, HttpCompletionOption.ResponseHeadersRead);
							stopwatch.Stop();
							
							if (response.IsSuccessStatusCode)
							{
								var content = await response.Content.ReadAsByteArrayAsync();
								var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";

								Response.Headers.Clear();

								foreach (var header in response.Headers)
								{
									if (!IsHeaderBlacklisted(header.Key))
									{
										Response.Headers[header.Key] = header.Value.ToArray();
									}
								}

								Response.Headers["Content-Type"] = contentType;

								return File(content, contentType);
							}
							else
							{
								throw new RobloxException(400, 0, $"{response.StatusCode}");
							}
						}
						catch (Exception ex)
						{				
							if (ex is TaskCanceledException && !ex.Message.Contains("canceled"))
							{
								throw new RobloxException(400, 0, "Timeout");
							}
							
							throw new RobloxException(400, 0, $"{ex.Message}");
						}
					}
					details = await services.assets.GetAssetCatalogInfo(assetId);
				}
			if (details.is18Plus && !isRcc && !isBotRequest && !is18OrOver)
				throw new RobloxException(400, 0, "AssetTemporarilyUnavailable");
			if (details.moderationStatus != ModerationStatus.ReviewApproved && !isRcc && !isBotRequest)
				throw new RobloxException(403, 0, "Asset is not approved");
            
            var latestVersion = await services.assets.GetLatestAssetVersion(assetId);
            Stream? assetContent = null;
            switch (details.assetType)
            {
				// Special types
				case Roblox.Models.Assets.Type.TeeShirt:
					var teeShirtData = ContentFormatters.GetTeeShirt(latestVersion.contentId);
					var teeShirtBytes = Encoding.UTF8.GetBytes(teeShirtData);
					return new MVC.FileContentResult(teeShirtBytes, "application/binary");

				case Models.Assets.Type.Shirt:
					var shirtData = ContentFormatters.GetShirt(latestVersion.contentId);
					var shirtBytes = Encoding.UTF8.GetBytes(shirtData);
					return new MVC.FileContentResult(shirtBytes, "application/binary");

				case Models.Assets.Type.Pants:
					var pantsData = ContentFormatters.GetPants(latestVersion.contentId);
					var pantsBytes = Encoding.UTF8.GetBytes(pantsData);
					return new MVC.FileContentResult(pantsBytes, "application/binary");
                // Types that require no authentication and aren't encrypted
                case Models.Assets.Type.Image:
                case Models.Assets.Type.Special:
                    if (latestVersion.contentUrl != null)
                        assetContent = await services.assets.GetAssetContent(latestVersion.contentUrl);
                    // encryptionEnabled = false;
                    break;
                // Types that require no authentication
                case Models.Assets.Type.Audio:
                case Models.Assets.Type.Mesh:
                case Models.Assets.Type.Hat:
                case Models.Assets.Type.Model:
                case Models.Assets.Type.Decal:
                case Models.Assets.Type.Head:
                case Models.Assets.Type.Face:
                case Models.Assets.Type.Gear:
                case Models.Assets.Type.Badge:
                case Models.Assets.Type.Animation:
                case Models.Assets.Type.Torso:
                case Models.Assets.Type.RightArm:
                case Models.Assets.Type.LeftArm:
                case Models.Assets.Type.RightLeg:
                case Models.Assets.Type.LeftLeg:
                case Models.Assets.Type.Package:
                case Models.Assets.Type.GamePass:
                case Models.Assets.Type.Plugin: // TODO: do plugins need auth?
                case Models.Assets.Type.MeshPart:
                case Models.Assets.Type.HairAccessory:
                case Models.Assets.Type.FaceAccessory:
                case Models.Assets.Type.NeckAccessory:
                case Models.Assets.Type.ShoulderAccessory:
                case Models.Assets.Type.FrontAccessory:
                case Models.Assets.Type.BackAccessory:
                case Models.Assets.Type.WaistAccessory:
                case Models.Assets.Type.ClimbAnimation:
                case Models.Assets.Type.DeathAnimation:
                case Models.Assets.Type.FallAnimation:
                case Models.Assets.Type.IdleAnimation:
                case Models.Assets.Type.JumpAnimation:
                case Models.Assets.Type.RunAnimation:
                case Models.Assets.Type.SwimAnimation:
                case Models.Assets.Type.WalkAnimation:
                case Models.Assets.Type.PoseAnimation:
                case Models.Assets.Type.SolidModel:
                    if (latestVersion.contentUrl is null)
                        throw new RobloxException(400, 0, "Content URL is null"); // todo: should we log this?
						Console.WriteLine($"[debug] no content URL for assetId: {assetId}, assetType: {details.assetType}, moderationStatus: {details.moderationStatus}");
                    if (details.assetType == Models.Assets.Type.Audio)
                    {
                        // Convert to WAV file since that's what web client requiResponse
                        assetContent = await services.assets.GetAudioContentAsWav(assetId, latestVersion.contentUrl);
                    }
                    else
                    {
                        assetContent = await services.assets.GetAssetContent(latestVersion.contentUrl);
                    }
                    break;
                default:
                    // anything else requiResponse auth
                    var ok = false;
                    if (isRcc)
                    {
                        encryptionEnabled = false;
                        var placeIdHeader = Request.Headers["roblox-place-id"].ToString();
                        long placeId = 0;
                        if (!string.IsNullOrEmpty(placeIdHeader))
                        {
                            try
                            {
                                placeId = long.Parse(Request.Headers["roblox-place-id"].ToString());
                            }
                            catch (FormatException)
                            {
                                // Ignore
                            }
                        }
                        // if rcc is trying to access current place, allow through
                        ok = (placeId == assetId);
                        // If game server is trying to load a new place (current placeId is empty), then allow it
                        if (!ok && details.assetType == Models.Assets.Type.Place && placeId == 0)
                        {
                            // Game server is trying to load, so allow it
                            ok = true;
                        }
                        // If rcc is making the request, but it's not for a place, validate the request:
                        if (!ok)
                        {
                            // Check permissions
                            var placeDetails = await services.assets.GetAssetCatalogInfo(placeId);
                            if (placeDetails.creatorType == details.creatorType &&
                                placeDetails.creatorTargetId == details.creatorTargetId)
                            {
                                // We are authorized
                                ok = true;
                            }
                        }
                    }
                    else
                    {
                        // It's not RCC making the request. are we authorized?
                        if (userSession != null)
                        {
                            // Use current user as access check
                            ok = await services.assets.CanUserModifyItem(assetId, userSession.userId);
                            if (!ok)
                            {
                                // Note that all users have access to "Roblox"'s content for legacy reasons
                                ok = (details.creatorType == CreatorType.User && details.creatorTargetId == 1);
                            }
#if DEBUG
                            // If staff, allow access in debug builds
                            if (await services.users.IsUserStaff(userSession.userId))
                            {
                                ok = true;
                            }
#endif
                            // Don't encrypt assets being sent to authorized users - they could be trying to download their own place to give to a friend or something
                            if (ok)
                            {
                                encryptionEnabled = false;
                            }
                        }
                    }

                    if (ok && latestVersion.contentUrl != null)
                    {
                        assetContent = await services.assets.GetAssetContent(latestVersion.contentUrl);
                    }

                    break;
            }

            if (assetContent != null)
            {
                return File(assetContent, "application/binary");
            }

            Console.WriteLine("[info] got BadRequest on /asset/ endpoint");
            throw new BadRequestException();
        }
		
		[HttpGet("Game/GamePass/GamePassHandler.ashx")]
		public async Task<MVC.ActionResult> GamePassHandler(string Action, long UserID, long PassID)
		{
			if (Action == "HasPass")
			{
				var has = await services.users.GetUserAssets(UserID, PassID);
				var Responseult = has.Any() ? "True" : "False";
				var xmlResponse = $"<Value Type=\"boolean\">{Responseult}</Value>";
				
				Response.ContentType = "text/xml; charset=utf-8";
				return Content(xmlResponse);
			}

			throw new NotImplementedException();
		}

        [HttpGet("Game/LuaWebService/HandleSocialRequest.ashx")]
        public async Task<string> LuaSocialRequest([Required, MVC.FromQuery] string method, long? playerid = null, long? groupid = null, long? userid = null)
        {
            // TODO: Implement these
			method = method.ToLower();
			if (method == "isingroup" && playerid != null && groupid != null)
			{
				bool isInGroup = false;

				if (playerid == 261 && groupid == 2868472)
				{
					return "<Value Type=\"boolean\">true</Value>";
				}

				try
				{
					if (groupid == 1200769 && await StaffFilter.IsStaff(playerid ?? 0))
					{
						isInGroup = true;
					}

					var group = await services.groups.GetUserRoleInGroup((long)groupid, (long)playerid);
					if (group.rank != 0)
						isInGroup = true;
				}
				catch (Exception)
				{
				}

				return "<Value Type=\"boolean\">" + (isInGroup ? "true" : "false") + "</Value>";
			}

			if (method == "getgrouprank" && playerid != null && groupid != null)
			{
				int rank = 0;

				if (playerid == 261 && groupid == 2868472)
				{
					return "<Value Type=\"integer\">254</Value>";
				}

				try
				{
					var group = await services.groups.GetUserRoleInGroup((long)groupid, (long)playerid);
					rank = group.rank;
				}
				catch (Exception)
				{
				}

				return "<Value Type=\"integer\">" + rank + "</Value>";
			}

            if (method == "getgrouprole" && playerid != null && groupid != null)
            {
                var groups = await services.groups.GetAllRolesForUser((long) playerid);
                foreach (var group in groups)
                {
                    if (group.groupId == groupid)
                    {
                        return group.name;
                    }
                }

                return "Guest";
            }

            if (method == "isfriendswith" && playerid != null && userid != null)
            {
                var status = (await services.friends.MultiGetFriendshipStatus((long) playerid, new[] {(long) userid})).FirstOrDefault();
                if (status != null && status.status == "Friends")
                {
                    return "<Value Type=\"boolean\">True</Value>";
                }
                return "<Value Type=\"boolean\">False</Value>";

            }

            if (method == "isbestfriendswith")
            {
                return "<Value Type\"boolean\">False</value>";
            }

            throw new NotImplementedException();
        }

		[HttpGet("login/negotiate.ashx"), HttpGet("login/negotiateasync.ashx")]
		public object Negotiate(string suggest)
		{
			HttpContext.Response.Cookies.Append(".ROBLOSECURITY", suggest, new CookieOptions
			{
				Domain = null,
				HttpOnly = true,
				Secure = true,
				Expires = DateTimeOffset.Now.Add(TimeSpan.FromDays(364)),
				IsEssential = true,
				Path = "/",
				SameSite = SameSiteMode.Lax,
			});

			return suggest;
		}
		
        [HttpGet("/auth/submit")]
        public MVC.RedirectResult SubmitAuth(string auth)
        {
            return new MVC.RedirectResult("/");
        }
		
		[HttpGetBypass("Game/LoadPlaceInfo.ashx")]
		public MVC.IActionResult LoadPlaceInfo([Required] long placeId)
		{
			return Ok();
		}
		
		[HttpGetBypass("asset/isowned")]
		public async Task<dynamic> CheckAssetOwnership([Required] long assetId)
		{
			if (userSession == null)
			{
				throw new RobloxException(401, 0, "Not authenticated");
			}

			var ownsAsset = (await services.users.GetUserAssets(userSession.userId, assetId)).Any();
			return new
			{
				isOwned = ownsAsset
			};
		}
		
	private const string ExpiredApplicationMessage = "For security reasons, this application has been expired. Please create a new application and try again.";
    private const string BadApplicationMessage =
	"This application is either not approved or has already been used. Please confirm the URL is correct, and try again.";
    private const string BadUsernameOrPasswordMessage = "Incorrect username or password. Please try again";
    private const string BadCaptchaMessage = "Your captcha could not be verified. Please try again.";
    private const string EmptyUsernameMessage = "Empty username";
    private const string EmptyPasswordMessage = "Empty password/password too short";
    private const string LoginDisabledMessage = "Login is disabled at this time. Try again later.";
    private const string RateLimitSecondMessage = "Too many attempts. Try again in a few seconds.";
    private const string RateLimit15MinutesMessage = "Too many attempts. Try again in 15 minutes.";
    private const string LockedAccountMessage = "This account is locked. Please contact us through Discord.";
			
	private static string HashString(string input)
	{
		using var sha256 = SHA256.Create();
		var bytes = Encoding.UTF8.GetBytes(input);
		var hashBytes = sha256.ComputeHash(bytes);
		return Convert.ToBase64String(hashBytes);
	}
		
	[HttpPostBypass("login")]
	public async Task<MVC.IActionResult> Login(
		[MVC.FromForm] string? username,
		[MVC.FromForm] string? password)
	{
		var ip = GetIP(GetRequesterIpRaw(HttpContext));
		var hashedIp = HashString(ip);

		try
		{
			FeatureFlags.FeatureCheck(FeatureFlag.LoginEnabled);
		}
		catch (RobloxException)
		{
			return Redirect("/?loginmsg=" + Uri.EscapeDataString(LoginDisabledMessage));
		}

		if (string.IsNullOrWhiteSpace(username))
		{
			return Redirect("/?loginmsg=" + Uri.EscapeDataString(EmptyUsernameMessage));
		}

		if (string.IsNullOrEmpty(password) || password.Length < 3)
		{
			return Redirect("/?loginmsg=" + Uri.EscapeDataString(EmptyPasswordMessage));
		}

		long userId = 0;
		try
		{
			userId = await services.users.GetUserIdFromUsername(username);
		}
		catch (RecordNotFoundException)
		{
			// Do nothing here.
		}

		if (!await services.cooldown.TryCooldownCheck("LoginAttemptV1:" + hashedIp, TimeSpan.FromSeconds(5)))
		{
			Roblox.Metrics.UserMetrics.ReportLoginConcurrentLockHit();
			return Redirect("/?loginmsg=" + Uri.EscapeDataString(RateLimitSecondMessage));
		}

		var loginKey = "LoginAttemptCountV1:" + hashedIp;
		var attemptCount = (await services.cooldown.GetBucketDataForKey(loginKey, TimeSpan.FromMinutes(10))).ToArray();

		if (!await services.cooldown.TryIncrementBucketCooldown(loginKey, 15, TimeSpan.FromMinutes(10), attemptCount, true))
		{
			Roblox.Metrics.UserMetrics.ReportLoginFloodCheckReached(attemptCount.Length);
			return Redirect("/?loginmsg=" + Uri.EscapeDataString(RateLimit15MinutesMessage));
		}

		var timer = new Stopwatch();
		timer.Start();
		if (userId == 0)
		{
			await PreventTimingExploits(timer);
			Roblox.Metrics.UserMetrics.ReportUserLoginAttempt(false);
			return Redirect("/?loginmsg=" + Uri.EscapeDataString(BadUsernameOrPasswordMessage));
		}

		var passwordOk = await services.users.VerifyPassword(userId, password);
		await PreventTimingExploits(timer);
		if (!passwordOk)
		{
			Roblox.Metrics.UserMetrics.ReportUserLoginAttempt(false);
			return Redirect("/?loginmsg=" + Uri.EscapeDataString(BadUsernameOrPasswordMessage));
		}

		var userinfo = await services.users.GetUserById(userId);
		if (userinfo.accountStatus == AccountStatus.MustValidateEmail)
		{
			return Redirect("/?loginmsg=" + Uri.EscapeDataString(LockedAccountMessage));
		}

		var sess = await services.users.CreateSession(userId);
		var sessionCookie = Middleware.SessionMiddleware.CreateJwt(new Middleware.JwtEntry()
		{
			sessionId = sess,
			createdAt = DateTimeOffset.Now.ToUnixTimeSeconds(),
		});
		
		// delete these here if the user already has an account
		Response.Cookies.Delete("discord_id");
		Response.Cookies.Delete("discord_profile");
		Response.Cookies.Delete("signupkey");

		HttpContext.Response.Cookies.Append(
			".ROBLOSECURITY", 
			sessionCookie,
			new CookieOptions
			{
				HttpOnly = true,
				Secure = true,
				SameSite = SameSiteMode.None,
				Expires = DateTimeOffset.Now.AddYears(1)
			});

		return Redirect("/home");
	}

	private async Task PreventTimingExploits(Stopwatch watch)
	{
		watch.Stop();
		Writer.Info(LogGroup.AbuseDetection, "PreventTimingExploits elapsed={0}ms", watch.ElapsedMilliseconds);
		const long sleepTimeMs = 200;
		var sleepTime = sleepTimeMs - watch.ElapsedMilliseconds;
		if (sleepTime is < 0 or > sleepTimeMs)
		{
			sleepTime = 0;
		}
		if (sleepTime != 0)
			await Task.Delay(TimeSpan.FromMilliseconds(sleepTime));
	}
	
	[HttpGet("UserCheck/checkifinvalidusernameforsignup")]
	public async Task<MVC.IActionResult> CheckUsernameAvailability([MVC.FromQuery] string username)
	{
		// 0 = available
		// 1 = taken
		// 2 = invalid
		
		// debug username to test forms
		if (username?.Equals("jongus", StringComparison.OrdinalIgnoreCase) == true)
			return Content("{\"data\":0}", "application/json");

		if (string.IsNullOrWhiteSpace(username))
			return Content("{\"data\":2}", "application/json");

		if (!await services.users.IsUsernameValid(username))
			return Content("{\"data\":2}", "application/json");

		if (!await services.users.IsNameAvailableForSignup(username))
			return Content("{\"data\":1}", "application/json");

		return Content("{\"data\":0}", "application/json");
	}
	
	private string EncryptWithKey(string input, string key)
	{
		using var aes = Aes.Create();
		aes.Key = Encoding.UTF8.GetBytes(key.PadRight(32, '\0')[..32]);
		aes.IV = new byte[16];
		
		var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
		using var ms = new MemoryStream();
		using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
		using (var sw = new StreamWriter(cs))
		{
			sw.Write(input);
		}
		
		return Convert.ToBase64String(ms.ToArray());
	}

	private string DecryptWithKey(string input, string key)
	{
		using var aes = Aes.Create();
		aes.Key = Encoding.UTF8.GetBytes(key.PadRight(32, '\0')[..32]);
		aes.IV = new byte[16];
		
		var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
		using var ms = new MemoryStream(Convert.FromBase64String(input));
		using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
		using var sr = new StreamReader(cs);
		
		return sr.ReadToEnd();
	}

	private bool ValidateSignupCookie()
	{
		const string key = "Thisisthezachydramaandthebubbabloxsignupkeyidksomerandomshithere";
		var cookie = Request.Cookies["signupkey"];
		
		if (string.IsNullOrEmpty(cookie))
			return false;
		
		try
		{
			var decrypted = DecryptWithKey(cookie, key);
			return decrypted.StartsWith("THISISABUBBABLOXSIGNUPKEYANDTHISISTHESTARTINGPOINTFORITPLZCHANGEME|") && 
				   decrypted.EndsWith("|BUBBABLOX");
		}
		catch
		{
			return false;
		}
	}
	
	[HttpGetBypass("discordcb")]
	public async Task<MVC.IActionResult> DiscordVerify([MVC.FromQuery] string code)
	{
		try
		{
			if (Request.Cookies["discord_id"] != null)
			{
				return Redirect("/");
			}

			var clientid = Roblox.Configuration.DiscordClientID;
			var clientsec = Roblox.Configuration.DiscordClientSecret;
			var redirurl = Roblox.Configuration.DiscordRedirect;

			var httpClient = new HttpClient();
			var parameters = new Dictionary<string, string>
			{
				{"client_id", clientid},
				{"client_secret", clientsec},
				{"grant_type", "authorization_code"},
				{"code", code},
				{"redirect_uri", redirurl}
			};

			var Response = await httpClient.PostAsync("https://discord.com/api/oauth2/token", 
				new FormUrlEncodedContent(parameters));
			
			if (!Response.IsSuccessStatusCode)
			{
				return Redirect("/?signupmsg=Discord verification failed. Please try again.");
			}

			var tokenResponse = await Response.Content.ReadFromJsonAsync<TokenRes>();
			
			httpClient.DefaultRequestHeaders.Authorization = 
				new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenResponse.access_token);
			
			var userResponse = await httpClient.GetAsync("https://discord.com/api/users/@me");
			var userinfo = await userResponse.Content.ReadFromJsonAsync<DiscordUser>();

			if (await services.users.IsDiscordIdUsed(userinfo.id))
			{
				return Redirect("/?signupmsg=This Discord account is already linked to another BubbaBlox account.");
			}

			var eligibilityCheck = await httpClient.GetAsync($"https://zawg.ca/assets/ecsr/sitetest.php?user={userinfo.id}");
			if (!eligibilityCheck.IsSuccessStatusCode)
			{
				return Redirect("/?signupmsg=You can not sign up at this time.");
			}
			
			var eligibilityResponse = await eligibilityCheck.Content.ReadAsStringAsync();
			if (!eligibilityResponse.Equals("true", StringComparison.OrdinalIgnoreCase))
			{
				return Redirect("/?signupmsg=You can not sign up at this time.");
			}

			const string key = "Thisisthezachydramaandthebubbabloxsignupkeyidksomerandomshithere";
			var token = $"THISISABUBBABLOXSIGNUPKEYANDTHISISTHESTARTINGPOINTFORITPLZCHANGEME|{DateTime.UtcNow:yyyyMMddHHmmss}|BUBBABLOX";
			var encryptedtoken = EncryptWithKey(token, key);
			
			HttpContext.Response.Cookies.Append("signupkey", encryptedtoken, new CookieOptions
			{
				HttpOnly = true,
				Secure = true,
				SameSite = SameSiteMode.Lax,
				Expires = DateTimeOffset.Now.AddDays(1)
			});

			HttpContext.Response.Cookies.Append("discord_id", userinfo.id, new CookieOptions
			{
				HttpOnly = true,
				Secure = true,
				SameSite = SameSiteMode.Lax,
				Expires = DateTimeOffset.Now.AddMinutes(10)
			});

			HttpContext.Response.Cookies.Append("discord_profile", JsonSerializer.Serialize(new 
			{
				id = userinfo.id,
				username = userinfo.username,
				discriminator = userinfo.discriminator,
				avatar = userinfo.avatar
			}), new CookieOptions
			{
				HttpOnly = false,
				Secure = true,
				SameSite = SameSiteMode.Lax,
				Expires = DateTimeOffset.Now.AddMinutes(10),
				Path = "/"
			});

			return Redirect("/");
		}
		catch (Exception ex)
		{
			Console.WriteLine($"Discord verification error: {ex.Message}");
			return Redirect("/?signupmsg=Discord verification failed. Please try again.");
		}
	}

	private class TokenRes
	{
		public string access_token { get; set; }
		public string token_type { get; set; }
		public int Expires_in { get; set; }
		public string refResponseh_token { get; set; }
		public string scope { get; set; }
	}

	private class DiscordUser
	{
		public string id { get; set; }
		public string username { get; set; }
		public string discriminator { get; set; }
		public string avatar { get; set; }
	}

	[HttpPostBypass("login/signup")]
	[MVC.Consumes("application/x-www-form-urlencoded")]
	public async Task<MVC.IActionResult> Signup(
		[MVC.FromForm] string username,
		[MVC.FromForm] string password,
		[MVC.FromForm] string birthday = null,
		[MVC.FromForm] int? gender = null,
		[MVC.FromForm] string context = null,
		[MVC.FromForm] bool isEligibleForHideAdsAbTest = false)
	{
		if (!ValidateSignupCookie())
		{
			return ReturnFormError("Registration is temporarily unavailable. Please try again later.", 
				new List<string> { "AbuseDetection-ERR" });
		}

		var discordUserId = Request.Cookies["discord_id"];
		if (string.IsNullOrEmpty(discordUserId))
		{
			return ReturnFormError("Registration is temporarily unavailable. Please try again later.", 
				new List<string> { "AbuseDetection-IDErr" });
		}

		if (await services.users.IsDiscordIdUsed(discordUserId))
		{
			return ReturnFormError("Registration is temporarily unavailable. Please try again later.", 
				new List<string> { "AbuseDetection-AlreadyUsed" });
		}
		
		MVC.IActionResult ReturnFormError(string generalMessage, List<string> reasons)
		{
			return StatusCode(403, new 
			{
				message = generalMessage,
				reasons = reasons,
				fieldErrors = new object[0] 
			});
		}

		try
		{
			FeatureFlags.FeatureCheck(FeatureFlag.SignupEnabled);
		}
		catch (RobloxException)
		{
			return ReturnFormError("Registration is temporarily unavailable. Please try again later.", 
				new List<string> { "AbuseDetection" });
		}

		var ip = GetIP(GetRequesterIpRaw(HttpContext));

		try
		{
			await services.cooldown.CooldownCheck($"signup:step1:" + ip, TimeSpan.FromSeconds(5));
		}
		catch (CooldownException)
		{
			Writer.Info(LogGroup.SignUp, "Sign up failed, cooldown step 1");
			return ReturnFormError("Too many attempts. Try again in about 5 seconds.", 
				new List<string> { "Cooldown" });
		}

		if (string.IsNullOrWhiteSpace(username))
			return ReturnFormError("Username is required", 
				new List<string> { "UsernameRequired" });

		if (!await services.users.IsUsernameValid(username))
			return ReturnFormError(
				"Invalid Username", 
				new List<string> { "InvalidUsername" });

		if (!await services.users.IsNameAvailableForSignup(username))
			return ReturnFormError("Username is already taken", 
				new List<string> { "UsernameTaken" });

		if (string.IsNullOrWhiteSpace(password))
			return ReturnFormError("Password is required", 
				new List<string> { "PasswordRequired" });

		if (!services.users.IsPasswordValid(password))
			return ReturnFormError(
				"Invalid password", 
				new List<string> { "InvalidPassword" });

		if (string.IsNullOrWhiteSpace(birthday))
			return ReturnFormError("Birthday is required", 
				new List<string> { "BirthdayRequired" });

		if (!gender.HasValue)
			return ReturnFormError("Gender is required", 
				new List<string> { "GenderRequired" });

		if (gender.Value != 2 && gender.Value != 3)
			return ReturnFormError("Invalid gender selection", 
				new List<string> { "InvalidGender" });

		if (!await Roblox.AbuseDetection.Report.UsersAbuse.ShouldAllowCreation(new(ip)))
			return ReturnFormError("Registration is temporarily unavailable. Please try again later.", 
				new List<string> { "AbuseDetection" });

		var signupFinalKey = "signup:step2:" + ip;
		try
		{
			await services.cooldown.CooldownCheck(signupFinalKey, TimeSpan.FromMinutes(5));
		}
		catch (CooldownException)
		{
			return ReturnFormError("Too many attempts. Try again in about 5 minutes.", 
				new List<string> { "Cooldown" });
		}

		try
		{
			var genderEnum = gender.Value switch
			{
				3 => Gender.Female,
				2 => Gender.Male,
				_ => Gender.Unknown
			};

			var createdUser = await services.users.CreateUser(username, password, genderEnum);

			if (!string.IsNullOrEmpty(discordUserId))
			{
				await services.users.LinkDiscordAccount(createdUser.userId, discordUserId);
			}

			var sess = await services.users.CreateSession(createdUser.userId);

			var sesscookie = Middleware.SessionMiddleware.CreateJwt(new Middleware.JwtEntry()
			{
				sessionId = sess,
				createdAt = DateTimeOffset.Now.ToUnixTimeSeconds(),
			});

			HttpContext.Response.Cookies.Append(
				".ROBLOSECURITY",
				sesscookie,
				new CookieOptions
				{
					HttpOnly = true,
					Secure = true,
					SameSite = SameSiteMode.None,
					Expires = DateTimeOffset.Now.AddYears(1)
				});

			var discordProfileJson = Request.Cookies["discord_profile"];
			DiscordProfile discordProfile = null;
			string discordUsername = "Unknown";
			string discordAvatarUrl = null;

			if (!string.IsNullOrEmpty(discordProfileJson))
			{
				try
				{
					discordProfile = JsonConvert.DeserializeObject<DiscordProfile>(discordProfileJson);
					discordUsername = $"{discordProfile.username}#{discordProfile.discriminator}";
					if (!string.IsNullOrEmpty(discordProfile.avatar))
					{
						discordAvatarUrl = $"https://cdn.discordapp.com/avatars/{discordUserId}/{discordProfile.avatar}.png";
					}
				}
				catch (Exception ex)
				{
					Writer.Info(LogGroup.SignUp, "failed to parse discord profile", ex);
				}
			}

			try
			{
				var webhook = Roblox.Configuration.SignupWebhook;
				string genderText = gender.Value == 3 ? "Female" : "Male";
				
				var embed = new
				{
					title = "Signup",
					description = $"A new user has signed up",
					color = 0x00ff00,
					thumbnail = new
					{
						url = discordAvatarUrl
					},
					fields = new[]
					{
						new
						{
							name = "Username",
							value = username,
							inline = true
						},
						new
						{
							name = "Gender",
							value = genderText,
							inline = true
						},
						new
						{
							name = "Discord ID",
							value = discordUserId,
							inline = true
						},
						new
						{
							name = "Discord Name",
							value = discordUsername,
							inline = true
						}
					},
					timestamp = DateTime.UtcNow.ToString("o")
				};

				var payload = new
				{
					embeds = new[] { embed }
				};

				using (var httpClient = new HttpClient())
				{
					var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
					await httpClient.PostAsync(webhook, content);
				}
			}
			catch (Exception ex)
			{
				Writer.Info(LogGroup.SignUp, "Failed to send signup notifiaction", ex);
			}

			Response.Cookies.Delete("discord_id");
			Response.Cookies.Delete("discord_profile");
			Response.Cookies.Delete("signupkey");
			
			return Redirect("/home");
		}
		catch (Exception ex)
		{
			await services.cooldown.ResetCooldown(signupFinalKey);
			Writer.Info(LogGroup.SignUp, "Signup failed", ex);
			return ReturnFormError("An unexpected error occurred. Please try again.", 
				new List<string> { "UnexpectedError" });
		}
	}
			
		[HttpGetBypass("game/get-data")]
		public async Task<dynamic> GetGameData([Required] long placeId, string? ticket = null)
		{
			try
			{
				long userId;
				
				if (!string.IsNullOrEmpty(ticket))
				{
					try 
					{
						var ticketData = services.gameServer.DecodeTicket(ticket, null);
						userId = ticketData.userId;
						
						if (userId <= 0)
						{
							throw new RobloxException(401, 0, "Invalid user ID in ticket");
						}

						var ticketUserInfo = await services.users.GetUserById(userId);
						if (ticketUserInfo == null)
						{
							throw new RobloxException(404, 0, "User not found");
						}
					}
					catch (Exception decodeEx)
					{
						Console.WriteLine($"[Ticket Validation Error] Failed to validate ticket: {decodeEx.Message}");
						throw new RobloxException(401, 0, "Invalid ticket");
					}
				}
				else if (userSession != null)
				{
					userId = userSession.userId;
				}
				else
				{
					throw new RobloxException(401, 0, "Not authenticated");
				}

				var userInfo = await services.users.GetUserById(userId);
				if (userInfo == null)
				{
					throw new RobloxException(404, 0, "User not found");
				}

				int accountAgeDays = (int)(DateTime.UtcNow - userInfo.created).TotalDays;

				var membership = await services.users.GetUserMembership(userId);
				string membershipType = membership?.membershipType switch
				{
					MembershipType.OutrageousBuildersClub => "OutrageousBuildersClub",
					MembershipType.TurboBuildersClub => "TurboBuildersClub",
					MembershipType.BuildersClub => "BuildersClub",
					_ => "None"
				};

				var placeDetails = await services.assets.GetAssetCatalogInfo(placeId);
				if (placeDetails == null || placeDetails.assetType != Type.Place)
				{
					throw new RobloxException(404, 0, "Place not found");
				}

				string creatorName;
				if (placeDetails.creatorType == CreatorType.User)
				{
					var creatorUser = await services.users.GetUserById(placeDetails.creatorTargetId);
					creatorName = creatorUser?.username ?? "Unknown";
				}
				else
				{
					creatorName = placeDetails.creatorName ?? "Unknown";
				}

				return new
				{
					success = true,
					user = new
					{
						userId = userId,
						username = userInfo.username,
						accountAgeDays = accountAgeDays,
						membershipType = membershipType
					},
					place = new
					{
						placeId = placeId,
						creatorId = placeDetails.creatorTargetId,
						creatorType = placeDetails.creatorType.ToString(),
						creatorName = creatorName
					}
				};
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = ex.Message
				};
			}
		}
		
		public static long startUserId {get;set;} = 30;
#if DEBUG
        [HttpGetBypass("/game/get-join-script-debug")]
        public async Task<dynamic> GetJoinScriptDebug(long placeId, long userId = 12)
        {
            //startUserId = 12;
            var Responseult = services.gameServer.CreateTicket(startUserId, placeId, GetIP());
            startUserId++;
            return new
            {
                placeLauncher = $"{Configuration.BaseUrl}/placelauncher.ashx?ticket={HttpUtility.UrlEncode(Responseult)}",
                authenticationTicket = Responseult,
            };
        }
#endif

		[HttpGetBypass("/game/PlaceLauncher.ashx")]
		[HttpPostBypass("/game/PlaceLauncher.ashx")]
		public async Task<MVC.IActionResult> PlaceLaunch()
		{
			try 
			{
				var plgs = $"{Configuration.GSUrl}/Game/PlaceLauncher.ashx{Request.QueryString}";
				
				using var httpClient = new HttpClient(new HttpClientHandler() {
					AllowAutoRedirect = false,
					UseCookies = false
				});

				httpClient.Timeout = TimeSpan.FromSeconds(30);
				
				foreach (var header in Request.Headers)
				{
					if (header.Key.Equals("Host", StringComparison.OrdinalIgnoreCase) || 
						header.Key.Equals("Connection", StringComparison.OrdinalIgnoreCase) ||
						header.Key.Equals("Accept-Encoding", StringComparison.OrdinalIgnoreCase) ||
						header.Key.Equals("Date", StringComparison.OrdinalIgnoreCase))
					{
						continue;
					}

					try
					{
						if (!httpClient.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value.ToArray()))
						{
							Console.WriteLine($"could not add header: {header.Key}");
						}
					}
					catch (Exception ex)
					{
						Console.WriteLine($"error adding header {header.Key}: {ex.Message}");
					}
				}

				var response = await httpClient.GetAsync(plgs, HttpCompletionOption.ResponseHeadersRead);

				var context = ControllerContext.HttpContext;
				foreach (var header in response.Headers)
				{
					if (header.Key.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase))
						continue;
						
					context.Response.Headers[header.Key] = header.Value.ToArray();
				}
				foreach (var header in response.Content.Headers)
				{
					if (header.Key.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase))
						continue;
						
					context.Response.Headers[header.Key] = header.Value.ToArray();
				}

				var contentStream = await response.Content.ReadAsStreamAsync();
				return new MVC.FileStreamResult(contentStream, 
					response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream");
			}
			catch (Exception ex)
			{
				Console.WriteLine($"placelauncher error: {ex}");
				return StatusCode(500, "Could not connect to game server!");
			}
		}

		[HttpGetBypass("/game/PlaceLauncherBT.ashx")]
		[HttpPostBypass("/game/PlaceLauncherBT.ashx")]
		public async Task<dynamic> PlaceLaunchBT(long placeId)
		{
			bool bypassSessionCheck = Request.Headers.TryGetValue("btzawgPHPgameserverstart", out var headerValue) 
									  && headerValue == "startgamesessionforthisplace";

			if (userSession == null && !bypassSessionCheck)
			{
				return BadRequest();
			}

			FeatureFlags.FeatureCheck(FeatureFlag.GamesEnabled, FeatureFlag.GameJoinEnabled);

			GameServerJwt details = new GameServerJwt
			{
				userId = userSession?.userId ?? 1,
				placeId = placeId,
				t = "GameJoinTicketV1.1",
				iat = DateTimeOffset.Now.ToUnixTimeSeconds(),
				ip = GetIP()
			};

			var Responseult = await services.gameServer.GetServerForPlace(details.placeId);
			if (Responseult.status == JoinStatus.Joining)
			{
				await Roblox.Metrics.GameMetrics.ReportGameJoinPlaceLauncherReturned(details.placeId);

				int serverPort = 0;
				if (GameServerService.currentGameServerPorts.TryGetValue(Responseult.job, out int port))
				{
					serverPort = port;
				}
				else
				{
					serverPort = -1;
				}

				var roblosecurity = Request.Cookies[".ROBLOSECURITY"];
				
				return new
				{
					jobId = Responseult.job,
					status = (int)Responseult.status,
					serverPort = serverPort,
					joinScriptUrl = $"{Configuration.BaseUrl}/game/join.ashx?placeid={placeId}&ticket={Uri.EscapeDataString(roblosecurity)}",
					authenticationUrl = Configuration.BaseUrl + "/Login/Negotiate.ashx",
					authenticationTicket = roblosecurity,
					message = (string?)null,
				};
			}

			return new
			{
				jobId = (string?)null,
				status = (int)Responseult.status,
				message = "Waiting for server",
			};
		}

		[HttpGetBypass("/game/Join.ashx")]
		[HttpPostBypass("/game/Join.ashx")]
		public async Task<MVC.IActionResult> JoinGame()
		{
			try 
			{
				var plgs = $"{Configuration.GSUrl}/Game/Join.ashx{Request.QueryString}";
				
				using var httpClient = new HttpClient(new HttpClientHandler() {
					AllowAutoRedirect = false,
					UseCookies = false
				});

				httpClient.Timeout = TimeSpan.FromSeconds(30);
				
				foreach (var header in Request.Headers)
				{
					if (header.Key.Equals("Host", StringComparison.OrdinalIgnoreCase) || 
						header.Key.Equals("Connection", StringComparison.OrdinalIgnoreCase) ||
						header.Key.Equals("Accept-Encoding", StringComparison.OrdinalIgnoreCase) ||
						header.Key.Equals("Date", StringComparison.OrdinalIgnoreCase))
					{
						continue;
					}

					try
					{
						if (!httpClient.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value.ToArray()))
						{
							Console.WriteLine($"could not add header: {header.Key}");
						}
					}
					catch (Exception ex)
					{
						Console.WriteLine($"error adding header {header.Key}: {ex.Message}");
					}
				}

				var response = await httpClient.GetAsync(plgs, HttpCompletionOption.ResponseHeadersRead);

				var context = ControllerContext.HttpContext;
				foreach (var header in response.Headers)
				{
					if (header.Key.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase))
						continue;
						
					context.Response.Headers[header.Key] = header.Value.ToArray();
				}
				foreach (var header in response.Content.Headers)
				{
					if (header.Key.Equals("Transfer-Encoding", StringComparison.OrdinalIgnoreCase))
						continue;
						
					context.Response.Headers[header.Key] = header.Value.ToArray();
				}

				var contentStream = await response.Content.ReadAsStreamAsync();
				return new MVC.FileStreamResult(contentStream, 
					response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream");
			}
			catch (Exception ex)
			{
				Console.WriteLine($"join.ashx error: {ex}");
				return StatusCode(500, "Could not connect to game server!");
			}
		}
		
		[HttpGetBypass("/universes/validate-place-join")]
		public async Task<string> ValidatePlaceJoin()
		{
			return "true";
		}

        [HttpGetBypass("Asset/CharacterFetch.ashx")]
        public async Task<string> CharacterFetch(long userId)
        {
            var assets = await services.avatar.GetWornAssets(userId);
            return
                $"{Configuration.BaseUrl}/Asset/BodyColors.ashx?userId={userId};{string.Join(";", assets.Select(c => Configuration.BaseUrl + "/Asset/?id=" + c))}";
        }
		    
        [HttpGet("marketplace/productinfo")]
        public async Task<dynamic> GetProductInfo(long assetId)
        {
            var details = await services.assets.GetAssetCatalogInfo(assetId);
            return new
            {
                TargetId = details.id,
                AssetId = details.id,
                ProductId = details.id,
                Name = details.name,
                Description = details.description,
                AssetTypeId = (int)details.assetType,
                IsForSale = details.isForSale,
                IsPublicDomain = details.isForSale && details.price == 0,
                Creator = new
                {
                    Id = details.creatorTargetId,
                    Name = details.creatorName,
                },
            };
        }

		private void CheckServerAuth(string auth)
		{
			const string expected = "THISISTHEAUTHFORRCCRAHHHHHHHHH";

/* 			Console.WriteLine($"[DEBUG] got auth: {auth}");

			Console.WriteLine($"[DEBUG] expected auth: {expected}");
 */
			if (auth != expected)
			{
				string requestUrl = HttpContext.Request.GetEncodedUrl();
				string requesterIp = GetRequesterIpRaw(HttpContext);

				Console.WriteLine($"[INFO] auth failed: {requestUrl}");

				Roblox.Metrics.GameMetrics.ReportRccAuthorizationFailure(requestUrl, auth, requesterIp);
				
				Console.WriteLine($"[ERROR] auth failed");

				throw new BadRequestException();
			}

			Console.WriteLine($"[INFO] auth success");
		}

        [HttpPostBypass("/gs/activity")]
        public async Task<dynamic> GetGsActivity([Required, MVC.FromBody] ReportActivity request)
        {
            Console.WriteLine(request.authorization);

            CheckServerAuth(request.authorization);
            var Responseult = await services.gameServer.GetLastServerPing(request.serverId);
            return new
            {
                isAlive = Responseult >= DateTime.UtcNow.Subtract(TimeSpan.FromMinutes(1)),
                updatedAt = Responseult,
            };
        }

        [HttpPostBypass("/gs/ping")]
        public async Task ReportServerActivity([Required, MVC.FromBody] ReportActivity request)
        {
            CheckServerAuth(request.authorization);
            await services.gameServer.SetServerPing(request.serverId);
        }

        [HttpPostBypass("/gs/delete")]
        public async Task DeleteServer([Required, MVC.FromBody] ReportActivity request)
        {
            CheckServerAuth(request.authorization);
            await services.gameServer.DeleteGameServer(request.serverId);
        }

		[HttpPostBypass("/gs/shutdown")]
		public async Task ShutDownServer([Required, MVC.FromBody] ReportActivity request)
		{
			CheckServerAuth(request.authorization);
			services.gameServer.ShutDownServer(request.serverId);
			
			try 
			{
				var wh = Roblox.Configuration.Webhook;
				if (!string.IsNullOrEmpty(wh))
				{
					var message = $"server {request.serverId} shut down";
					
					using (var httpClient = new HttpClient())
					{
						var payload = new { content = message };
						var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
						await httpClient.PostAsync(wh, content);
					}
				}
			}
			catch (Exception ex)
			{
				Console.WriteLine($"error sending shutdown notification to Discord: {ex.Message}");
			}
		}

		[HttpPostBypass("/gs/players/report")]
		public async Task ReportPlayerActivity([Required, MVC.FromBody] ReportPlayerActivity request)
		{
			CheckServerAuth(request.authorization);
			
			if (request.eventType == "Leave")
			{
				await services.gameServer.OnPlayerLeave(request.userId, request.placeId, request.serverId);
				
				try 
				{
					var wh = Roblox.Configuration.Webhook;
					if (!string.IsNullOrEmpty(wh))
					{
						var userInfo = await services.users.GetUserById(request.userId);
						var message = $"player {userInfo.username} (ID: {request.userId}) left place {request.placeId} on server {request.serverId}";
						
						using (var httpClient = new HttpClient())
						{
							var payload = new { content = message };
							var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
							await httpClient.PostAsync(wh, content);
						}
					}
				}
				catch (Exception ex)
				{
					Console.WriteLine($"error sending leave to Discord: {ex.Message}");
				}
			}
			else if (request.eventType == "Join")
			{
				await Roblox.Metrics.GameMetrics.ReportGameJoinSuccess(request.placeId);
				await services.gameServer.OnPlayerJoin(request.userId, request.placeId, request.serverId);

				try 
				{
					var wh = Roblox.Configuration.Webhook;
					if (!string.IsNullOrEmpty(wh))
					{
						var userInfo = await services.users.GetUserById(request.userId);
						var message = $"player {userInfo.username} (ID: {request.userId}) joined place {request.placeId} on server {request.serverId}";
						
						using (var httpClient = new HttpClient())
						{
							var payload = new { content = message };
							var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
							await httpClient.PostAsync(wh, content);
						}
					}
				}
				catch (Exception ex)
				{
					Console.WriteLine($"error sending join to Discord: {ex.Message}");
				}
			}
			else
			{
				throw new Exception("unexpected type " + request.eventType);
			}
		}

        [HttpPostBypass("/gs/a")]
        public void ReportGS()
        {
            // Doesn't do anything yet. See: services/api/src/controllers/bypass.ts:1473
            return;
        }

        [HttpPostBypass("/Game/ValidateTicket.ashx")]
        public async Task<string> ValidateClientTicketRcc([Required, MVC.FromBody] ValidateTicketRequest request)
        {
#if DEBUG
            return "true";
#endif
            
            try
            {
                // Below is intentionally caught by local try/catch. RCC could crash if we give a 500 error.
                FeatureFlags.FeatureCheck(FeatureFlag.GamesEnabled, FeatureFlag.GameJoinEnabled);
                var ticketData = services.gameServer.DecodeTicket(request.ticket, null);
                if (ticketData.userId != request.expectedUserId)
                {
                    // Either bug or someone broke into RCC
                    Roblox.Metrics.GameMetrics.ReportTicketErrorUserIdNotMatchingTicket(request.ticket,
                        ticketData.userId, request.expectedUserId);
                    throw new Exception("Ticket userId does not match expected userId");
                }
                // From TS: it is possible for a client to spoof username or appearance to be empty string, 
                // so make sure you don't do much validation on those params (aside from assertion that it's a string)
                if (request.expectedUsername != null)
                {
                    var userInfo = await services.users.GetUserById(ticketData.userId);
                    if (userInfo.username != request.expectedUsername)
                    {
                        throw new Exception("Ticket username does not match expected username");
                    }
                }

                if (request.expectedAppearanceUrl != null)
                {
                    // will always be format of "http://localhost/Asset/CharacterFetch.ashx?userId=12", NO EXCEPTIONS!
                    var expectedUrl =
                        $"{Roblox.Configuration.BaseUrl}/Asset/CharacterFetch.ashx?userId={ticketData.userId}";
                    if (request.expectedAppearanceUrl != expectedUrl)
                    {
                        throw new Exception("Character URL is bad");
                    }
                }
                
                // Confirm user isn't already in a game
                var gameStatus = (await services.users.MultiGetPresence(new [] {ticketData.userId})).First();
                if (gameStatus.placeId != null && gameStatus.userPresenceType == PresenceType.InGame)
                {
                    // Make sure that the only game they are playing is the one they are trying to join.
                    var playingGames = await services.gameServer.GetGamesUserIsPlaying(ticketData.userId);
                    foreach (var game in playingGames)
                    {
                        if (game.id != request.gameJobId)
                            throw new Exception("User is already playing another game");
                    }
                }

                return "true";
            }
            catch (Exception e)
            {
                Console.WriteLine("[error] Verify ticket failed. Error = {0}\n{1}", e.Message, e.StackTrace);
                return "false";
            }
        }

        [HttpPostBypass("/game/validate-machine")]
        public dynamic ValidateMachine()
        {
            return new
            {
                success = true,
                message = "",
            };
        }

        [HttpGetBypass("Users/ListStaff.ashx")]
        public async Task<IEnumerable<long>> GetStaffList()
        {
            return (await StaffFilter.GetStaff()).Where(c => c != 12);
        }

        [HttpGetBypass("Users/GetBanStatus.ashx")]
        public async Task<IEnumerable<dynamic>> MultiGetBanStatus(string userIds)
        {

            var ids = userIds.Split(",").Select(long.Parse).Distinct();
            var Responseult = new List<dynamic>();
#if DEBUG
            return ids.Select(c => new
            {
                userId = c,
                isBanned = false,
            });
#else
            var multiGetResult = await services.users.MultiGetAccountStatus(ids);
            foreach (var user in multiGetResult)
            {
                Responseult.Add(new
                {
                    userId = user.userId,
                    isBanned = user.accountStatus != AccountStatus.Ok,
                });
            }

            return Responseult;
#endif
        }

        [HttpGetBypass("Asset/BodyColors.ashx")]
        public async Task<string> GetBodyColors(long userId)
        {
            var colors = await services.avatar.GetAvatar(userId);

            var xsi = XNamespace.Get("http://www.w3.org/2001/XMLSchema-instance");

            var robloxRoot = new XElement("roblox",
                new XAttribute(XNamespace.Xmlns + "xmime", "http://www.w3.org/2005/05/xmlmime"),
                new XAttribute(XNamespace.Xmlns + "xsi", "http://www.w3.org/2001/XMLSchema-instance"),
                new XAttribute(xsi + "noNamespaceSchemaLocation", "http://www.roblox.com/roblox.xsd"),
                new XAttribute("version", 4)
            );
            robloxRoot.Add(new XElement("External", "null"));
            robloxRoot.Add(new XElement("External", "nil"));
            var items = new XElement("Item", new XAttribute("class", "BodyColors"));
            var properties = new XElement("Properties");
            // set colors
            properties.Add(new XElement("int", new XAttribute("name", "HeadColor"), colors.headColorId.ToString()));
            properties.Add(new XElement("int", new XAttribute("name", "LeftArmColor"), colors.leftArmColorId.ToString()));
            properties.Add(new XElement("int", new XAttribute("name", "LeftLegColor"), colors.leftLegColorId.ToString()));
            properties.Add(new XElement("string", new XAttribute("name", "Name"), "Body Colors"));
            properties.Add(new XElement("int", new XAttribute("name", "RightArmColor"), colors.rightArmColorId.ToString()));
            properties.Add(new XElement("int", new XAttribute("name", "RightLegColor"), colors.rightLegColorId.ToString()));
            properties.Add(new XElement("int", new XAttribute("name", "TorsoColor"), colors.torsoColorId.ToString()));
            properties.Add(new XElement("bool", new XAttribute("name", "archivable"), "true"));
            // add
            items.Add(properties);
            robloxRoot.Add(items);
            // return as string
            return new XDocument(robloxRoot).ToString();
        }

        [MVC.HttpPost("/moderation/filtertext/")]
        public dynamic GetModerationText()
        {
            var text = HttpContext.Request.Form["text"].ToString();
            return new
            {
                data = new
                {
                    white = text,
                    black = text,
                },
            };
        }

        private void ValidateBotAuthorization()
        {
#if DEBUG == false
	        if (Request.Headers["bot-auth"].ToString() != Roblox.Configuration.BotAuthorization)
	        {
		        throw new Exception("Internal");
	        }
#endif
        }

        [HttpGetBypass("botapi/migrate-alltypes")]
        public async Task<dynamic> MigrateAllItemsBot([Required, MVC.FromQuery] string url)
        {
            ValidateBotAuthorization();
            return await MigrateItem.MigrateItemFromRoblox(url, false, null, new List<Type>()
            {
                Type.Image,
                Type.Audio,
                Type.Mesh,
                Type.Lua,
                Type.Model,
                Type.Decal,
                Type.Animation,
                Type.SolidModel,
                Type.MeshPart,
                Type.ClimbAnimation,
                Type.DeathAnimation,
                Type.FallAnimation,
                Type.IdleAnimation,
                Type.JumpAnimation,
                Type.RunAnimation,
                Type.SwimAnimation,
                Type.WalkAnimation,
                Type.PoseAnimation,
            }, default, false);
        }

        [HttpGetBypass("botapi/migrate-clothing")]
        public async Task<dynamic> MigrateClothingBot([Required] string assetId)
        {
            ValidateBotAuthorization();
            return await MigrateItem.MigrateItemFromRoblox(assetId, true, 5, new List<Models.Assets.Type>() { Models.Assets.Type.TeeShirt, Models.Assets.Type.Shirt, Models.Assets.Type.Pants });
        }
        
        [HttpGetBypass("BuildersClub/Upgrade.ashx")]
        public MVC.IActionResult UpgradeNow()
        {
            return new MVC.RedirectResult("/buildersclub");
        }
		
		[HttpPostBypass("buildersclub/membership")]
		public async Task<dynamic> UpdateMembership([Required, MVC.FromForm] string membershipType)
		{
			if (userSession == null)
				throw new RobloxException(401, 0, "Not authenticated");

			if (!Enum.TryParse<MembershipType>(membershipType, out var membershipTypeParsed) || 
				!Enum.IsDefined(membershipTypeParsed))
			{
				throw new RobloxException(400, 0, "Invalid membership type");
			}

			await services.users.InsertOrUpdateMembership(userSession.userId, membershipTypeParsed);
			var metadata = MembershipMetadata.GetMetadata(membershipTypeParsed);
			
			return new
			{
				success = true,
				message = $"Membership successfully changed to {metadata.displayName}. You will now receive {metadata.dailyRobux} Robux each day.",
				newMembership = membershipTypeParsed.ToString()
			};
		}
        
        [HttpGetBypass("GetAllowedMD5Hashes")]
        public MVC.ActionResult<dynamic> AllowedMD5Hashes()
        {
            List<string> allowedList = new List<string>()
            {
                "d0780fcc43a4004332ebcfd64886875c"
            };

            return new { data = allowedList };
        }
        
		[HttpGetBypass("GetAllowedSecurityVersions")]
		[HttpGetBypass("GetAllowedSecurityKeys")]
		public Microsoft.AspNetCore.Mvc.IActionResult AllowedSecurityVersions()
		{
			return new Microsoft.AspNetCore.Mvc.ContentResult 
			{
				Content = @"{""data"": [""""I'm so silly""""]}",
				ContentType = "text/plain"
			};
		}
        
        [HttpGetBypass("Setting/QuietGet/{type}")]
        public MVC.ActionResult<dynamic> GetAppSettings(string type)
        {
            try
            {
                string jsonFilePath = Path.Combine(Configuration.JsonDataDirectory, type + ".json");
                string jsonContent = System.IO.File.ReadAllText(jsonFilePath);
                dynamic? clientAppSettingsData = JsonConvert.DeserializeObject<ExpandoObject>(jsonContent);

                return clientAppSettingsData ?? "";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[RetrieveClientFFlags] Error while retrieving FFlags: {ex.Message}");
                return new { };
            }
        }

        [HttpGetBypass("abusereport/UserProfile"), HttpGetBypass("abusereport/asset"), HttpGetBypass("abusereport/user"), HttpGetBypass("abusereport/users")]
        public MVC.IActionResult ReportAbuseRedirect()
        {
            return new MVC.RedirectResult("/internal/report-abuse");
        }

        [HttpGetBypass("/info/blog")]
        public MVC.IActionResult RedirectToUpdates()
        {
            return new MVC.RedirectResult("/internal/updates");
        }

        [HttpGetBypass("/my/economy-status")]
        public dynamic GetEconomyStatus()
        {
            return new
            {
                isMarketplaceEnabled = true,
                isMarketplaceEnabledForAuthenticatedUser = true,
                isMarketplaceEnabledForUser = true,
                isMarketplaceEnabledForGroup = true,
            };
        }

        [HttpGetBypass("/currency/balance")]
        public async Task<dynamic> GetBalance()
        {
            return await services.economy.GetBalance(CreatorType.User, safeUserSession.userId);
        }

        [HttpGetBypass("/ownership/hasasset")]
        public async Task<string> DoesOwnAsset(long userId, long assetId)
        {
            return (await services.users.GetUserAssets(userId, assetId)).Any() ? "true" : "false";
        }

        [HttpPostBypass("persistence/increment")]
        public async Task<dynamic> IncrementPersistence(long placeId, string key, string type, string scope, string target, int value)
        {
            // increment?placeId=%i&key=%s&type=%s&scope=%s&target=&value=%i
            
            if (!IsRcc())
                throw new RobloxException(400, 0, "BadRequest");
            
            return new
            {
                data = (object?) null,
            };
        }

        [HttpPostBypass("persistence/getSortedValues")]
        public async Task<dynamic> GetSortedPersistenceValues(long placeId, string type, string scope, string key, int pageSize, bool ascending, int inclusiveMinValue = 0, int inclusiveMaxValue = 0)
        {
            // persistence/getSortedValues?placeId=0&type=sorted&scope=global&key=Level%5FHighscoResponse20&pageSize=10&ascending=False"
            // persistence/set?placeId=124921244&key=BF2%5Fds%5Ftest&&type=standard&scope=global&target=BF2%5Fds%5Fkey%5Ftmp&valueLength=31
            
            if (!IsRcc())
                throw new RobloxException(400, 0, "BadRequest");
            
            return new
            {
                data = new
                {
                    Entries = ArraySegment<int>.Empty,
                    ExclusiveStartKey = (string?)null,
                },
            };
        }

        [HttpPostBypass("persistence/getv2")]
        public async Task<dynamic> GetPersistenceV2(long placeId, string type, string scope)
        {
            var rawBody = await new StreamReader(Request.Body).ReadToEndAsync();
            if (rawBody.StartsWith("&"))
            {
                rawBody = rawBody.Substring(1);
            }
            // getV2?placeId=%i&type=%s&scope=%s
            // Expected format is:
            //	{ "data" : 
            //		[
            //			{	"Value" : value,
            //				"Scope" : scope,							
            //				"Key" : key,
            //				"Target" : target
            //			}
            //		]
            //	}
            // or for non-existing key:
            // { "data": [] }
            
            // for no sub key:
            // Expected format is:
            //	{ "data" : value }
            Console.WriteLine("Request = {0}", rawBody);
            using var ds = ServiceProvider.GetOrCreate<DataStoreService>();
            var requests = rawBody.Split("\n").Where(c => !string.IsNullOrWhiteSpace(c)).Distinct();
            
            var Responseult = new List<GetKeyEntry>();
            foreach (var request in requests)
            {
                var des = JsonSerializer.Deserialize<GetKeyScope>(request);
                
                var Response = await ds.Get(placeId, type, des.scope ?? scope, des.key, des.target);
                if (!string.IsNullOrWhiteSpace(Response))
                    Responseult.Add(new GetKeyEntry()
                    {
                        Key = des.key,
                        Scope = des.scope ?? scope,
                        Target =des.target,
                        Value = Response,
                    });
            }

            if (!IsRcc())
                throw new RobloxException(400, 0, "BadRequest");
            
            return new
            {
                data = Responseult,
            };
        }

        [HttpPostBypass("persistence/set")]
        public async Task<dynamic> Set(long placeId, string key, string type, string scope, string target, int valueLength, [Required, MVC.FromBody] SetRequest request)
        {
            // { "data" : value }
            if (!IsRcc())
                throw new RobloxException(400, 0, "BadRequest");
            await ServiceProvider.GetOrCreate<DataStoreService>()
                .Set(placeId, target, type, scope, key, valueLength, request.data);
            
            return new
            {
                data = request.data,
            };
        }
		
		private static string FormatTimeSpan(TimeSpan span)
		{
			if (span.TotalDays >= 1)
				return $"{(int)span.TotalDays} day{(span.TotalDays >= 2 ? "s" : "")}";
			if (span.TotalHours >= 1)
				return $"{(int)span.TotalHours} hour{(span.TotalHours >= 2 ? "s" : "")}";
			if (span.TotalMinutes >= 1)
				return $"{(int)span.TotalMinutes} minute{(span.TotalMinutes >= 2 ? "s" : "")}";
			return $"{(int)span.TotalSeconds} second{(span.TotalSeconds >= 2 ? "s" : "")}";
		}
		
		[HttpGetBypass("promocodes/redeem")]
		public async Task<dynamic> RedeemPromoCode(
			[Required] string code,
			[MVC.FromServices] NpgsqlConnection db)
		{
			if (userSession == null)
			{
				throw new RobloxException(401, 0, "Not authenticated");
			}

			code = code.Trim().ToUpper();
			var userId = userSession.userId;

			PromoCodeEntry promoCode;
			try
			{
				promoCode = await db.QuerySingleOrDefaultAsync<PromoCodeEntry>(
					"SELECT * FROM promocodes WHERE code = @code",
					new { code });

				if (promoCode == null)
				{
					throw new RobloxException(400, 0, "This promocode does not exist");
				}

				var currentUtcTime = DateTime.UtcNow;
				var ExpiresAtUtc = promoCode.Expires_at.HasValue 
					? DateTime.SpecifyKind(promoCode.Expires_at.Value, DateTimeKind.Utc)
					: (DateTime?)null;

				if (!promoCode.is_active)
				{
					throw new RobloxException(400, 0, "This promocode is no longer active");
				}

				if (ExpiresAtUtc.HasValue && ExpiresAtUtc.Value < currentUtcTime)
				{
					var timeSinceExpired = currentUtcTime - ExpiresAtUtc.Value;
					throw new RobloxException(400, 0, 
						/* $"This promocode expired {FormatTimeSpan(timeSinceExpired)} ago"); */
						"This promocode has expired");
				}

				if (promoCode.Expires_at.HasValue && promoCode.Expires_at.Value < DateTime.UtcNow)
				{
					throw new RobloxException(400, 0, "This promocode has expired");
				}

				if (promoCode.max_uses.HasValue && promoCode.use_count >= promoCode.max_uses.Value)
				{
					throw new RobloxException(400, 0, "This promocode has reached it's maximum redemptions");
				}

				var hasRedeemed = await db.ExecuteScalarAsync<int>(
					"SELECT COUNT(*) FROM promocode_redemptions WHERE user_id = @userId AND promocode_id = @promoCodeId",
					new { userId, promoCodeId = promoCode.id }) > 0;

				if (hasRedeemed)
				{
					throw new RobloxException(400, 0, "You have already redeemed this promocode");
				}

				using var transaction = await db.BeginTransactionAsync();
				try
				{
					await db.ExecuteAsync(
						"UPDATE promocodes SET use_count = use_count + 1 WHERE id = @id",
						new { id = promoCode.id },
						transaction);

					await db.ExecuteAsync(
						"INSERT INTO promocode_redemptions (promocode_id, user_id, asset_id, robux_amount) " +
						"VALUES (@promoCodeId, @userId, @assetId, @robuxAmount)",
						new
						{
							promoCodeId = promoCode.id,
							userId,
							assetId = promoCode.asset_id,
							robuxAmount = promoCode.robux_amount
						},
						transaction);

					if (promoCode.asset_id.HasValue)
					{
						await db.ExecuteAsync(
							"INSERT INTO user_asset (user_id, asset_id) VALUES (@userId, @assetId)",
							new { userId, assetId = promoCode.asset_id.Value },
							transaction);
					}

					if (promoCode.robux_amount.HasValue && promoCode.robux_amount.Value > 0)
					{
						await db.ExecuteAsync(
							"UPDATE user_economy SET balance_robux = balance_robux + @amount WHERE user_id = @userId",
							new { userId, amount = promoCode.robux_amount.Value },
							transaction);
					}

					await transaction.CommitAsync();
				}
				catch
				{
					await transaction.RollbackAsync();
					throw;
				}

				string assetName = null;
				if (promoCode.asset_id.HasValue)
				{
					try
					{
						var assetInfo = await services.assets.GetAssetCatalogInfo(promoCode.asset_id.Value);
						assetName = assetInfo.name;
					}
					catch { /* ignore */ }
				}

				return new
				{
					success = true,
					message = "Promocode redeemed successfully!",
					assetId = promoCode.asset_id,
					assetName,
					robuxAmount = promoCode.robux_amount
				};
			}
			finally
			{
			}
		}
    }
}