namespace GanttApp.Core.DTOs;

public record CreateTaskDto(
    string Title,
    DateTime StartDate,
    DateTime EndDate,
    int Progress,
    Guid? ParentId,
    int Order,
    string[] Dependencies
);
