namespace GanttApp.Core.DTOs;

public record ProjectDto(
    Guid Id,
    string Name,
    string Description,
    Guid OwnerId,
    DateTime CreatedAt
);
