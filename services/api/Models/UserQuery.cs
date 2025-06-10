namespace GamerUncle.Api.Models
{
    public class UserQuery
    {
        public required string Query { get; set; }
        public string? UserId { get; set; }
        public string? ConversationId { get; set; } // optional, client-managed
    }
}