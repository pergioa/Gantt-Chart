

namespace GanttApp.Core.DTOs;

public record CreateProjectDto(
string Name,
string Description,
Guid OwnerId
);