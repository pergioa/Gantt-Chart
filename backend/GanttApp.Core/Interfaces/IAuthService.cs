using GanttApp.Core.DTOs;

namespace GanttApp.Core.Interfaces;

public interface IAuthService
{
    /// <summary>Registers a new user. Throws InvalidOperationException if email is already taken.</summary>
    Task<UserDto> RegisterAsync(RegisterDto dto);

    /// <summary>Validates credentials and returns a JWT + refresh token. Throws UnauthorizedAccessException on bad credentials.</summary>
    Task<AuthResponseDto> LoginAsync(LoginDto dto);

    /// <summary>Rotates the refresh token and issues a new JWT. Throws UnauthorizedAccessException if token is invalid/expired.</summary>
    Task<AuthResponseDto> RefreshTokenAsync(string rawToken, Guid userId);

    /// <summary>Revokes the matching refresh token. Silently succeeds if token is not found.</summary>
    Task LogoutAsync(string rawToken, Guid userId);
}
