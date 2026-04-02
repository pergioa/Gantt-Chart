using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using GanttApp.Core.DTOs;
using GanttApp.Core.Entities;
using GanttApp.Core.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace GanttApp.Infrastructure.Services;

public class AuthService(AppDbContext context, IConfiguration configuration) : IAuthService
{
    private readonly AppDbContext _context = context;
    private readonly IConfiguration _configuration = configuration;

    /// <inheritdoc/>
    public async Task<UserDto> RegisterAsync(RegisterDto dto)
    {
        if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
            throw new InvalidOperationException("Email is already in use.");

        var user = new User
        {
            Name = dto.Name,
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password, workFactor: 12),
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return new UserDto(user.Id, user.Email, user.Name);
    }

    /// <inheritdoc/>
    public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
    {
        var exists = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
        if (exists is null)
            throw new UnauthorizedAccessException("Invalid Credentials");

        if (!BCrypt.Net.BCrypt.Verify(dto.Password, exists.PasswordHash))
            throw new UnauthorizedAccessException("Invalid Credentials");

        var accessToken = GenerateJwtToken(exists);
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(64));
        var tokenHash = BCrypt.Net.BCrypt.HashPassword(rawToken, workFactor: 12);

        var refreshToken = new RefreshToken
        {
            UserId = exists.Id,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false,
        };

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        return new AuthResponseDto(
            accessToken,
            rawToken,
            new UserDto(exists.Id, exists.Email, exists.Name)
        );
    }

    /// <inheritdoc/>
    public async Task<AuthResponseDto> RefreshTokenAsync(string rawToken, Guid userId)
    {
        var tokens = await _context
            .RefreshTokens.Where(t =>
                t.UserId == userId && !t.IsRevoked && t.ExpiresAt > DateTime.UtcNow
            )
            .ToListAsync();

        var match = tokens.FirstOrDefault(t => BCrypt.Net.BCrypt.Verify(rawToken, t.TokenHash));
        if (match is null)
            throw new UnauthorizedAccessException("Invalid or expired refresh token.");

        match.IsRevoked = true;

        var user =
            await _context.Users.FindAsync(userId)
            ?? throw new UnauthorizedAccessException("User not found.");

        var newRawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(64));
        _context.RefreshTokens.Add(
            new RefreshToken
            {
                UserId = userId,
                TokenHash = BCrypt.Net.BCrypt.HashPassword(newRawToken, workFactor: 12),
                ExpiresAt = DateTime.UtcNow.AddDays(7),
            }
        );

        await _context.SaveChangesAsync();

        return new AuthResponseDto(
            GenerateJwtToken(user),
            newRawToken,
            new UserDto(user.Id, user.Email, user.Name)
        );
    }

    /// <inheritdoc/>
    public async Task LogoutAsync(string rawToken, Guid userId)
    {
        var tokens = await _context
            .RefreshTokens.Where(t => t.UserId == userId && !t.IsRevoked)
            .ToListAsync();

        var match = tokens.FirstOrDefault(t => BCrypt.Net.BCrypt.Verify(rawToken, t.TokenHash));
        if (match is not null)
        {
            match.IsRevoked = true;
            await _context.SaveChangesAsync();
        }
    }

    private string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Secret"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("name", user.Name),
            new Claim(
                JwtRegisteredClaimNames.Iat,
                DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64
            ),
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
