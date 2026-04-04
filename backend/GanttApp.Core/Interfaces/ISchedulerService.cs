using GanttApp.Core.DTOs;

namespace GanttApp.Core.Interfaces;

public interface ISchedulerService
{
    /// <summary>
    /// Cascades date shifts from a changed task to all downstream successors
    /// using a topological sort. Returns all tasks that were modified.
    /// </summary>
    Task<IEnumerable<TaskDto>> CascadeTaskDatesAsync(Guid projectId, Guid changedTaskId);
}
