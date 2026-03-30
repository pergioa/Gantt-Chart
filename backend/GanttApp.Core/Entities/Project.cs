namespace GanttApp.Core.Entities;

public class Project
{
    public Guid Id { get; set; }
    public User Owner { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public ICollection<ProjectTask> Tasks { get; set; } = [];
}