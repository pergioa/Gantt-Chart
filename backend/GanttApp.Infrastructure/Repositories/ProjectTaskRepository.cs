using GanttApp.Core.Entities;
using GanttApp.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GanttApp.Infrastructure.Repositories;

public class ProjectTaskRepository(AppDbContext context) : IProjectTaskRepository
{
    private readonly DbSet<ProjectTask> _dbSet = context.Set<ProjectTask>();

    public async Task<ProjectTask> CreateAsync(ProjectTask task)
    {
        _dbSet.Add(task);
        await context.SaveChangesAsync();
        return task;
    }

    public async Task DeleteAsync(Guid id)
    {
        var task = await _dbSet.FindAsync(id);
        if (task is null)
            return;
        _dbSet.Remove(task);
        await context.SaveChangesAsync();
    }

    public async Task<ProjectTask?> GetByIdAsync(Guid id)
    {
        return await _dbSet
            .AsNoTracking()
            .Include(t => t.Dependencies)
            .FirstOrDefaultAsync(t => t.Id == id);
    }

    public async Task<IEnumerable<ProjectTask>> GetByProjectIdAsync(Guid projectId)
    {
        return await _dbSet
            .AsNoTracking()
            .Include(t => t.Dependencies)
            .Where(t => t.ProjectId == projectId)
            .OrderBy(t => t.Order)
            .ToListAsync();
    }

    public async Task<ProjectTask> UpdateAsync(ProjectTask task)
    {
        _dbSet.Update(task);
        await context.SaveChangesAsync();
        return task;
    }
}
