namespace GanttApp.Core.Entities;

public class ProjectTask
{
    public Guid Id { get; set; }
    public Guid ProjectId { get; set; }
    public Project Project { get; set; } = null!;
    public string Title { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int Progress { get; set; }
    public Guid? ParentId { get; set; }
    public ProjectTask? Parent { get; set; }
    public int Order { get; set; }
    public DateTime CreatedAt { get; set; }
    public ICollection<ProjectTask> Children { get; set; } = [];
}
