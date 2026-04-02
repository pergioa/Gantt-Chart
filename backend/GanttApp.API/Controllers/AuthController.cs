using GanttApp.Core.DTOs;
using GanttApp.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace GanttApp.API.Controllers;

[ApiController]
[Route("auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    private readonly IAuthService _authService = authService;

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        return CreatedAtAction(nameof(Register), await _authService.RegisterAsync(dto));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        return Ok(await _authService.LoginAsync(dto));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] TokenRequestDto dto)
    {
        return Ok(await _authService.RefreshTokenAsync(dto.Token, dto.UserId));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] TokenRequestDto dto)
    {
        await _authService.LogoutAsync(dto.Token, dto.UserId);
        return NoContent();
    }
}
