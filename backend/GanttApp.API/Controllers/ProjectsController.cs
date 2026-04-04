using System.Security.Claims;
using GanttApp.Core.DTOs;
using GanttApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GanttApp.API.Controllers;

[ApiController]
[Authorize]
[Route("projects")]
public class ProjectsController(
    IProjectService projectService,
    IProjectTaskService projectTaskService
) : ControllerBase
{
    private readonly IProjectService _projectService = projectService;
    private readonly IProjectTaskService _projectTaskService = projectTaskService;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        return Ok(await _projectService.GetAllAsync(userId));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetByID(Guid id) => Ok(await _projectService.GetByIdAsync(id));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectDto project)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var result = await _projectService.CreateAsync(project, userId);
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

    [HttpPatch("{id:guid}/tasks/batch")]
    public async Task<IActionResult> BatchUpdate(Guid id, [FromBody] BatchUpdateDto dto)
    {
        var result = await _projectTaskService.BatchUpdateAsync(id, dto);
        return Ok(result);
    }
}
