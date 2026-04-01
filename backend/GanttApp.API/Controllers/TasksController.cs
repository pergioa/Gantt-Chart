using GanttApp.Core.DTOs;
using GanttApp.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace GanttApp.API.Controllers;

[ApiController]
public class TasksController(IProjectTaskService projectTaskService) : ControllerBase
{
    private readonly IProjectTaskService _projectTaskService = projectTaskService;

    [HttpGet("projects/{projectId:guid}/tasks")]
    public async Task<IActionResult> GetByProjectId(Guid projectId)
    {
        return Ok(await _projectTaskService.GetByProjectIdAsync(projectId));
    }

    [HttpPost("projects/{projectId:guid}/tasks")]
    public async Task<IActionResult> Create(Guid projectId, [FromBody] CreateTaskDto createTaskDto)
    {
        var result = await _projectTaskService.CreateAsync(projectId, createTaskDto);
        return CreatedAtAction(nameof(GetByProjectId), new {projectId}, result);
    }

    [HttpPut("tasks/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTaskDto updateTaskDto)
    {
        return Ok(await _projectTaskService.UpdateAsync(id, updateTaskDto));
    }

    [HttpDelete("tasks/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _projectTaskService.DeleteAsync(id);
        return NoContent();
    }
}