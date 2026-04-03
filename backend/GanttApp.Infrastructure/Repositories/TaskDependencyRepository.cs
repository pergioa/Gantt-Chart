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

    public async Task ReplaceForTaskAsync(Guid successorId, IEnumerable<Guid> predecessorIds)
    {
        var existing = await _dbSet.Where(d => d.SuccessorId == successorId).ToListAsync();

        _dbSet.RemoveRange(existing);

        var incoming = predecessorIds.Select(predecessorId => new TaskDependency
        {
            PredecessorId = predecessorId,
            SuccessorId = successorId,
        });

        await _dbSet.AddRangeAsync(incoming);
        await context.SaveChangesAsync();
    }
}
