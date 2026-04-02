namespace GanttApp.Core.DTOs;

public record AuthResponseDto(string AccessToken, string RefreshToken, UserDto User);
