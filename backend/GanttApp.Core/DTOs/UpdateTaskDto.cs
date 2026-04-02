namespace GanttApp.Core.DTOs;

public record UpdateTaskDto(
    Guid? ParentId,
    string Title,
    DateTime StartDate,
    DateTime EndDate,
    int Order,
    int Progress
);
