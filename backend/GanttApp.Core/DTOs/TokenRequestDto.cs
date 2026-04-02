namespace GanttApp.Core.DTOs;

/// <summary>Used for both /auth/refresh and /auth/logout — the client sends back the raw refresh token + userId.</summary>
public record TokenRequestDto(string Token, Guid UserId);
