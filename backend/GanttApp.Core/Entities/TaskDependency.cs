using GanttApp.Core.Enums;

namespace GanttApp.Core.Entities;

public class TaskDependency
{
    public Guid Id { get; set; }
    public Guid PredecessorId { get; set; }
    public ProjectTask? Predecessor { get; set; }
    public Guid SuccessorId { get; set; }
    public ProjectTask? Successor { get; set; }
    public DependencyType Type { get; set; }
}
