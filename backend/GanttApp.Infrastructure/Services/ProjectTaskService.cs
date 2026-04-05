using AutoMapper;
using GanttApp.Core.DTOs;
using GanttApp.Core.Entities;
using GanttApp.Core.Interfaces;

namespace GanttApp.Infrastructure.Services;

public class ProjectTaskService(
    IProjectTaskRepository projectTaskRepository,
    IProjectRepository projectRepository,
    ITaskDependencyRepository taskDependencyRepository,
    ISchedulerService schedulerService,
    IUnitOfWork unitOfWork,
    IMapper mapper
) : IProjectTaskService
{
    private readonly IProjectTaskRepository _projectTaskRepository = projectTaskRepository;
    private readonly IProjectRepository _projectRepository = projectRepository;
    private readonly ITaskDependencyRepository _taskDependencyRepository = taskDependencyRepository;
    private readonly ISchedulerService _schedulerService = schedulerService;
    private readonly IUnitOfWork _unitOfWork = unitOfWork;
    private readonly IMapper _mapper = mapper;

    public async Task<TaskDto> CreateAsync(Guid projectId, CreateTaskDto dto)
    {
        var project = await _projectRepository.GetByIdAsync(projectId);
        if (project is null)
            throw new KeyNotFoundException($"Project {projectId} not found.");

        var entity = _mapper.Map<ProjectTask>(dto);
        entity.ProjectId = projectId;

        var created = await _projectTaskRepository.CreateAsync(entity);

        if (dto.Dependencies.Length > 0)
            await _taskDependencyRepository.ReplaceForTaskAsync(created.Id, dto.Dependencies);

        var result = await _projectTaskRepository.GetByIdAsync(created.Id);
        return _mapper.Map<TaskDto>(result!);
    }

    public Task<IEnumerable<TaskDto>> BatchUpdateAsync(Guid projectId, BatchUpdateDto dto)
    {
        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var affectedById = new Dictionary<Guid, TaskDto>();

            foreach (var item in dto.Tasks)
            {
                var updateDto = new UpdateTaskDto(
                    item.ParentId,
                    item.Title,
                    item.StartDate,
                    item.EndDate,
                    item.Order,
                    item.Progress,
                    item.Dependencies
                );

                var updated = await UpdateAsync(item.Id, updateDto);
                affectedById[updated.Id] = updated;

                var cascaded = await _schedulerService.CascadeTaskDatesAsync(projectId, item.Id);
                foreach (var t in cascaded)
                    affectedById[t.Id] = t;
            }

            return (IEnumerable<TaskDto>)affectedById.Values;
        });
    }

    public async Task DeleteAsync(Guid id)
    {
        await _taskDependencyRepository.DeleteForTaskAsync(id);
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

        await _taskDependencyRepository.ReplaceForTaskAsync(id, dto.Dependencies);

        var updated = await _projectTaskRepository.GetByIdAsync(id);
        return _mapper.Map<TaskDto>(updated!);
    }
}
