namespace GamerUncle.Api.Models
{
    public class BoardGameSearchResult
    {
        public string Name { get; set; }
        public int MinPlayers { get; set; }
        public int MaxPlayers { get; set; }
        public string ImageUrl { get; set; }
        public string Description { get; set; }
    }
}
