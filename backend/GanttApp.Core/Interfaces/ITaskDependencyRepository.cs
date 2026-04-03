using GanttApp.Core.Entities;

namespace GanttApp.Core.Interfaces;

public interface ITaskDependencyRepository
{
    Task<IEnumerable<TaskDependency>> GetByProjectIdAsync(Guid projectId);
    Task ReplaceForTaskAsync(Guid successorId, IEnumerable<Guid> predecessorIds);
}
