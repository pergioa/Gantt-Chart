using GanttApp.Core.Entities;
using GanttApp.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GanttApp.Infrastructure.Repositories;

public class ProjectRepository(AppDbContext context) : IProjectRepository
{
    private readonly DbSet<Project> _dbSet = context.Set<Project>();

    /// <summary>Returns all projects.</summary>
    public async Task<IEnumerable<Project>> GetAllAsync() =>
        await _dbSet.AsNoTracking().ToListAsync();

    /// <summary>Returns a single project by id, or null if not found.</summary>
    public async Task<Project?> GetByIdAsync(Guid id) =>
        await _dbSet.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);

    /// <summary>Creates a new project and returns it with the database-generated id.</summary>
    public async Task<Project> CreateAsync(Project project)
    {
        _dbSet.Add(project);
        await context.SaveChangesAsync();
        return project;
    }

    /// <summary>Updates an existing project and returns it.</summary>
    public async Task<Project> UpdateAsync(Project project)
    {
        _dbSet.Update(project);
        await context.SaveChangesAsync();
        return project;
    }

    /// <summary>Deletes a project by id. No-ops if already deleted.</summary>
    public async Task DeleteAsync(Guid id)
    {
        var project = await _dbSet.FindAsync(id);
        if (project is null)
            return;
        _dbSet.Remove(project);
        await context.SaveChangesAsync();
    }
}
