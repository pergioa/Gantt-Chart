using GanttApp.Core.DTOs;

namespace GanttApp.Core.Interfaces;

public interface IProjectTaskService
{
    Task<IEnumerable<TaskDto>> GetByProjectIdAsync(Guid projectId);

    Task<TaskDto> CreateAsync(Guid projectId, CreateTaskDto dto);
    Task<TaskDto> UpdateAsync(Guid id, UpdateTaskDto dto);
    Task DeleteAsync(Guid id);
}