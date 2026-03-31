using GanttApp.Core.DTOs;

namespace GanttApp.Core.Interfaces;

public interface IProjectService
{
    Task<IEnumerable<ProjectDto>> GetAllAsync();
    Task<ProjectDto> GetByIdAsync(Guid id);
    Task<ProjectDto> CreateAsync(CreateProjectDto dto);
    Task<ProjectDto> UpdateAsync(Guid id, UpdateProjectDto dto);
    Task DeleteAsync(Guid id);
}