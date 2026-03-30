namespace GanttApp.Core.DTOs;

public record TaskDto(
    Guid Id,
    Guid ProjectId,
    string Title,
    DateTime StartDate,
    DateTime EndDate,
    int Progress,
    Guid? ParentId,
    int Order,
    DateTime CreatedAt
    );

