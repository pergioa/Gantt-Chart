using AutoMapper;
using GanttApp.Core.DTOs;
using GanttApp.Core.Entities;
using GanttApp.Core.Interfaces;

namespace GanttApp.Infrastructure.Services;

public class ProjectTaskService(
    IProjectTaskRepository projectTaskRepository,
    IProjectRepository projectRepository,
    ITaskDependencyRepository taskDependencyRepository,
    IMapper mapper
) : IProjectTaskService
{
    private readonly IProjectTaskRepository _projectTaskRepository = projectTaskRepository;
    private readonly IProjectRepository _projectRepository = projectRepository;
    private readonly ITaskDependencyRepository _taskDependencyRepository = taskDependencyRepository;
    private readonly IMapper _mapper = mapper;

    public async Task<TaskDto> CreateAsync(Guid projectId, CreateTaskDto dto)
    {
        var project = await _projectRepository.GetByIdAsync(projectId);
        if (project is null)
            throw new KeyNotFoundException($"Project {projectId} not found.");

        var entity = _mapper.Map<ProjectTask>(dto);
        entity.ProjectId = projectId;

        var created = await _projectTaskRepository.CreateAsync(entity);

        return _mapper.Map<TaskDto>(created);
    }

    public async Task DeleteAsync(Guid id)
    {
        await _projectTaskRepository.DeleteAsync(id);
    }

    public async Task<IEnumerable<TaskDto>> GetByProjectIdAsync(Guid projectId)
    {
        var project = await _projectRepository.GetByIdAsync(projectId);
        if (project is null)
            throw new KeyNotFoundException($"Project {projectId} not found.");

        var tasks = await _projectTaskRepository.GetByProjectIdAsync(projectId);

        return _mapper.Map<IEnumerable<TaskDto>>(tasks);
    }

    public async Task<TaskDto> UpdateAsync(Guid id, UpdateTaskDto dto)
    {
        var existing = await _projectTaskRepository.GetByIdAsync(id);
        if (existing is null)
            throw new KeyNotFoundException($"Task {id} not found.");

        existing = _mapper.Map(dto, existing);
        await _projectTaskRepository.UpdateAsync(existing);

        var predecessorIds = dto.Dependencies.Select(Guid.Parse);
        await _taskDependencyRepository.ReplaceForTaskAsync(id, predecessorIds);

        var updated = await _projectTaskRepository.GetByIdAsync(id);
        return _mapper.Map<TaskDto>(updated!);
    }
}
