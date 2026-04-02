using GanttApp.Core.DTOs;
using GanttApp.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace GanttApp.API.Controllers;

[ApiController]
[Route("projects")]
public class ProjectsController(
    IProjectService projectService,
    IProjectTaskService projectTaskService
) : ControllerBase
{
    private readonly IProjectService _projectService = projectService;
    private readonly IProjectTaskService _projectTaskService = projectTaskService;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _projectService.GetAllAsync());

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetByID(Guid id) => Ok(await _projectService.GetByIdAsync(id));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectDto project)
    {
        var result = await _projectService.CreateAsync(project);
        return CreatedAtAction(nameof(GetByID), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProjectDto updateProjectDto)
    {
        return Ok(await _projectService.UpdateAsync(id, updateProjectDto));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _projectService.DeleteAsync(id);
        return NoContent();
    }

    [HttpGet("{projectId:guid}/tasks")]
    public async Task<IActionResult> GetTasks(Guid projectId)
    {
        return Ok(await _projectTaskService.GetByProjectIdAsync(projectId));
    }

    [HttpPost("{projectId:guid}/tasks")]
    public async Task<IActionResult> CreateTask(
        Guid projectId,
        [FromBody] CreateTaskDto createTaskDto
    )
    {
        var result = await _projectTaskService.CreateAsync(projectId, createTaskDto);
        return CreatedAtAction(nameof(GetTasks), new { projectId }, result);
    }
}
