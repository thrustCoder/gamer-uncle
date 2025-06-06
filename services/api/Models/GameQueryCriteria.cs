public class GameQueryCriteria
{
    public string? name { get; set; }
    public int? MinPlayers { get; set; }
    public int? MaxPlayers { get; set; }
    public int? MinPlaytime { get; set; }
    public int? MaxPlaytime { get; set; }
    public string[]? Mechanics { get; set; }
    public string[]? Categories { get; set; }
    public double? MaxWeight { get; set; }
    public double? averageRating { get; set; }
    public int? ageRequirement { get; set; }
}
