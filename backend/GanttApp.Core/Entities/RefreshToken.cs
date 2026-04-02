namespace GanttApp.Core.Entities;

public class RefreshToken
{
    public Guid Id {get; set;}
    public Guid UserId {get; set;}
    public string TokenHash {get; set;} = null!;
    public DateTime ExpiresAt {get; set;}
    public bool IsRevoked {get; set;}
}