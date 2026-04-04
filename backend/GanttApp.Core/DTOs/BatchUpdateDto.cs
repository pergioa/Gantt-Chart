namespace GanttApp.Core.DTOs;

public record BatchTaskDto(
    Guid Id,
    Guid? ParentId,
    string Title,
    DateTime StartDate,
    DateTime EndDate,
    int Order,
    int Progress,
    TaskDependencyDto[] Dependencies
);

public record BatchUpdateDto(List<BatchTaskDto> Tasks);
