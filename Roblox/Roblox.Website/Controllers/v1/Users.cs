using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Roblox.Dto.Users;
using Roblox.Exceptions;
using Roblox.Models.Users;
using Roblox.Exceptions.Services.Users;
using Roblox.Services.Exceptions;
using Roblox.Models;
using System.Text.Json;

namespace Roblox.Website.Controllers;

[ApiController]
[Route("/apisite/users/v1")]
public class UsersControllerV1 : ControllerBase
{
	[HttpGet("users/authenticated")]
	public async Task<IActionResult> GetMySession()
	{
		if (userSession is null)
		{
			return Unauthorized(new { error = "User is not authenticated" });
		}

		var httpClient = new HttpClient();
		httpClient.BaseAddress = new Uri(Configuration.BaseUrl);
		
		httpClient.DefaultRequestHeaders.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7");
		httpClient.DefaultRequestHeaders.Add("Upgrade-Insecure-Requests", "1");
		httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36");
		
		try
		{
			string requestUrl = $"/Game/LuaWebService/HandleSocialRequest.ashx?method=isInGroup&playerid={userSession.userId}&groupid=1200769";

			var stopwatch = System.Diagnostics.Stopwatch.StartNew();
			var response = await httpClient.GetAsync(requestUrl);
			stopwatch.Stop();

			if (response.IsSuccessStatusCode)
			{
				var content = await response.Content.ReadAsStringAsync();
				Console.WriteLine($"[DEBUG] Staff response:\n{content}");

				bool isStaff = content.Contains("<Value Type=\"boolean\">true</Value>");
				Console.WriteLine($"[DEBUG] isStaff: {isStaff}");

				var result = new
				{
					id = userSession.userId,
					name = userSession.username,
					displayName = userSession.username,
					isStaff = isStaff
				};

				return new JsonResult(result);
			}
			else
			{
				var errorContent = await response.Content.ReadAsStringAsync();
				Console.WriteLine($"[ERROR] failed to check staff status");
			}
		}
		catch (Exception ex)
		{
			Console.WriteLine($"[ERROR] error checking user authentication:");
			Console.WriteLine(ex.ToString());
		}

		var fallbackResult = new
		{
			id = userSession.userId,
			name = userSession.username,
			displayName = userSession.username,
			isStaff = false
		};

		Console.WriteLine($"failed to get staff status returning no");
		return new JsonResult(fallbackResult);
	}
	
	[HttpGet("users/{userId:long}")]
    public async Task<dynamic> GetUserById(long userId)
    {
        var info = await services.users.GetUserById(userId);
        var isBanned =
            info.accountStatus != AccountStatus.Ok && 
            info.accountStatus != AccountStatus.MustValidateEmail && 
            info.accountStatus != AccountStatus.Suppressed;
        
        return new
        {
            id = info.userId,
            name = info.username,
            displayName = info.username,
            info.description,
            info.created,
            isBanned,
        };
    }

    [HttpPost("users")]
    public async Task<dynamic> MultiGetUsersById([Required, FromBody] MultiGetRequest request)
    {
        var ids = request.userIds.ToList();
        if (ids.Count > 200 || ids.Count < 1)
        {
            throw new BadRequestException(0, "Invalid IDs");
        }

        var result = await services.users.MultiGetUsersById(ids);
        return new
        {
            data = result,
        };
    }

    [HttpPost("usernames/users")]
    public async Task<dynamic> MultiGetUsersByUsername([Required, FromBody] MultiGetByNameRequest request)
    {
        var names = request.usernames.ToList();
        if (names.Count > 200 || names.Count < 1)
        {
            throw new BadRequestException(0, "Invalid Usernames");
        }

        var result = await services.users.MultiGetUsersByUsername(request.usernames);
        return new
        {
            data = result,
        };
    }

    [HttpGet("users/{userId:long}/status")]
    public async Task<dynamic> GetUserStatus([Required] long userId)
    {
        var result = await services.users.GetUserStatus(userId);
        if (string.IsNullOrEmpty(result.status))
        {
            return new
            {
                status = (string?)null,
            };
        }

        return result;
    }

    [HttpPatch("users/{userId:long}/status")]
    public async Task SetUserStatus([Required, FromBody] SetStatusRequest request)
    {
        try
        {
            await services.users.SetUserStatus(userSession.userId, request.status);
        }
        catch (Exception e) when (e is StatusTooLongException or StatusTooShortException)
        {
            throw new RobloxException(400, 2, "Invalid request");
        }
    }

    [HttpGet("users/{userId:long}/username-history")]
    public async Task<RobloxCollectionPaginated<Roblox.Website.WebsiteModels.Users.PreviousUsernameEntry>> GetPreviousUsernames([Required] long userId, int limit = 100, string? cursor = null)
    {
        var userInfo = await services.users.GetUserById(userId);
        if (userInfo.IsDeleted()) throw new RobloxException(400, 0, "User is invalid or does not exist");
        var entries = (await services.users.GetPreviousUsernames(userId)).Select(c => new WebsiteModels.Users.PreviousUsernameEntry(c.username));
        return new()
        {
            data = entries,
        };
    }
}

