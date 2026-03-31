using GanttApp.Core.Entities;

namespace GanttApp.Core.Interfaces;

public interface IProjectTaskRepository
{
    Task<IEnumerable<ProjectTask>> GetByProjectIdAsync(Guid projectId);
    Task<ProjectTask?> GetByIdAsync(Guid id);
    Task<ProjectTask> CreateAsync(ProjectTask task);
    Task<ProjectTask> UpdateAsync(ProjectTask task);
    Task DeleteAsync(Guid id);
}