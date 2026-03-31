using AutoMapper;
using GanttApp.Core.DTOs;
using GanttApp.Core.Entities;
using GanttApp.Core.Interfaces;

namespace GanttApp.Infrastructure.Services;

public class ProjectService( IProjectRepository repository, IMapper mapper) : IProjectService
{
    private readonly IProjectRepository _repository = repository;
    private readonly IMapper _mapper = mapper;
    
    public async Task<ProjectDto> CreateAsync(CreateProjectDto dto)
    {
        var entity = _mapper.Map<Project>(dto);
        var created = await _repository.CreateAsync(entity);
        return _mapper.Map<ProjectDto>(created);
    }

    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id);
    }

    public async Task<IEnumerable<ProjectDto>> GetAllAsync()
    {
        var projects = await _repository.GetAllAsync();
        return _mapper.Map<IEnumerable<ProjectDto>>(projects);
    }

    public async Task<ProjectDto> GetByIdAsync(Guid id)
    {
        var entity = await _repository.GetByIdAsync(id);

        if (entity is null) throw new KeyNotFoundException($"Project {id} not found.");

        return  _mapper.Map<ProjectDto>(entity);
    }

    public async Task<ProjectDto> UpdateAsync(Guid id, UpdateProjectDto dto)
    {
        var existing = await _repository.GetByIdAsync(id);
        
        if (existing is null) throw new KeyNotFoundException($"Project {id} not found.");

        existing = _mapper.Map(dto,existing);
        var updated = await _repository.UpdateAsync(existing);
        return _mapper.Map<ProjectDto>(updated);
    }
}