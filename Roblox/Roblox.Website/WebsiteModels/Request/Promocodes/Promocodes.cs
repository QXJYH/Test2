namespace Roblox.Website.WebsiteModels.Promocodes;

public class PromoCodeEntry
{
	public int id { get; set; }
	public string code { get; set; }
	public long? asset_id { get; set; }
	public int? robux_amount { get; set; }
	public DateTime created_at { get; set; }
	public DateTime? Expires_at { get; set; }
	public int? max_uses { get; set; }
	public int use_count { get; set; }
	public bool is_active { get; set; }
}