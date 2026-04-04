using GanttApp.Core.Enums;

namespace GanttApp.Core.DTOs;

public record TaskDependencyDto(string PredecessorId, DependencyType Type);
