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
        var project = await _dbSet.FindAsync(id)
            ?? throw new KeyNotFoundException($"Task {id} not found.");
        _dbSet.Remove(project);
        await context.SaveChangesAsync();
    }

    public async Task<ProjectTask?> GetByIdAsync(Guid id)
    {
        return await _dbSet.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
    }

    public async Task<IEnumerable<ProjectTask>> GetByProjectIdAsync(Guid projectId)
    {
        return await _dbSet.AsNoTracking()
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