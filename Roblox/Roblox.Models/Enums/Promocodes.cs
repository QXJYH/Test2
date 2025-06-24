namespace Roblox.Models.Promocodes
{
    public class PCResult
    {
        public bool success { get; set; }
        public string message { get; set; }
        public long? assetId { get; set; }
        public string assetName { get; set; }
        public int? robuxAmount { get; set; }
        public bool showResult { get; set; } = false;
    }
    
    public class ErrorResponse
    {
        public List<Error> errors { get; set; }
    }
    
    public class Error
    {
        public int code { get; set; }
        public string message { get; set; }
    }
}

