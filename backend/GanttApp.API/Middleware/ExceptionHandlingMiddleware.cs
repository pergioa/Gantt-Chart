using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace GanttApp.API.Middleware;


public class ExceptionHandlingMiddleware( RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger )
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception e)
        {
            logger.LogError(e, e.Message);
            
            var (statusCode, title) = e switch
            {
                KeyNotFoundException => (404, "Resource Not Found"),
                UnauthorizedAccessException => (401, "Unauthorized"),
                ArgumentException => (400, "Bad Request"),
                _ => (500, "An unexpected error occurred")
            };
            
            context.Response.StatusCode = statusCode;
            context.Response.ContentType = "application/problem+json";

            var problemDetails = new ProblemDetails
            {
                Status = statusCode,
                Title = title,
                Detail = e.Message,
                Instance = context.Request.Path
            };
            
            await context.Response.WriteAsync(JsonSerializer.Serialize(problemDetails, JsonSerializerOptions.Web));
        }
    }
}