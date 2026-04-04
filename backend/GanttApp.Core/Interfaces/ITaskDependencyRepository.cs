using GanttApp.Core.DTOs;
using GanttApp.Core.Entities;

namespace GanttApp.Core.Interfaces;

public interface ITaskDependencyRepository
{
    Task<IEnumerable<TaskDependency>> GetByProjectIdAsync(Guid projectId);
    Task ReplaceForTaskAsync(Guid successorId, IEnumerable<TaskDependencyDto> dependencies);
    Task DeleteForTaskAsync(Guid taskId);
}
