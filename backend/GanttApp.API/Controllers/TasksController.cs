using GanttApp.Core.DTOs;
using GanttApp.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace GanttApp.API.Controllers;

[ApiController]
[Route("tasks")]
public class TasksController(IProjectTaskService projectTaskService) : ControllerBase
{
    private readonly IProjectTaskService _projectTaskService = projectTaskService;

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTaskDto updateTaskDto)
    {
        return Ok(await _projectTaskService.UpdateAsync(id, updateTaskDto));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _projectTaskService.DeleteAsync(id);
        return NoContent();
    }
}
