using GanttApp.Core.DTOs;
using GanttApp.Core.Entities;
using GanttApp.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GanttApp.Infrastructure.Repositories;

public class TaskDependencyRepository(AppDbContext context) : ITaskDependencyRepository
{
    private readonly DbSet<TaskDependency> _dbSet = context.Set<TaskDependency>();

    public async Task<IEnumerable<TaskDependency>> GetByProjectIdAsync(Guid projectId)
    {
        return await _dbSet
            .AsNoTracking()
            .Where(d => d.Successor!.ProjectId == projectId)
            .ToListAsync();
    }

    public async Task DeleteForTaskAsync(Guid taskId)
    {
        var rows = await _dbSet
            .Where(d => d.SuccessorId == taskId || d.PredecessorId == taskId)
            .ToListAsync();

        _dbSet.RemoveRange(rows);
        await context.SaveChangesAsync();
    }

    public async Task ReplaceForTaskAsync(Guid successorId, IEnumerable<TaskDependencyDto> dependencies)
    {
        var existing = await _dbSet.Where(d => d.SuccessorId == successorId).ToListAsync();

        _dbSet.RemoveRange(existing);

        var incoming = dependencies.Select(dep => new TaskDependency
        {
            PredecessorId = Guid.Parse(dep.PredecessorId),
            SuccessorId = successorId,
            Type = dep.Type,
        });

        await _dbSet.AddRangeAsync(incoming);
        await context.SaveChangesAsync();
    }
}
