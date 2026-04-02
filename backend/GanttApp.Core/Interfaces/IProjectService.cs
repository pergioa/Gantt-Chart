using GanttApp.Core.DTOs;

namespace GanttApp.Core.Interfaces;

public interface IProjectService
{
    Task<IEnumerable<ProjectDto>> GetAllAsync(Guid userId);
    Task<ProjectDto> GetByIdAsync(Guid id);
    Task<ProjectDto> CreateAsync(CreateProjectDto dto, Guid userId);
    Task<ProjectDto> UpdateAsync(Guid id, UpdateProjectDto dto);
    Task DeleteAsync(Guid id);
}
