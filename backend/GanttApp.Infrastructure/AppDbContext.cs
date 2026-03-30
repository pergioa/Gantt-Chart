using GanttApp.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace GanttApp.Infrastructure;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users { get; set; }
    public DbSet<Project> Projects { get; set; }
    public DbSet<ProjectTask> ProjectTasks { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.Property(u => u.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(u => u.Email).IsRequired().HasMaxLength(256);
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Name).IsRequired().HasMaxLength(256);
            e.Property(u => u.PasswordHash).IsRequired();
            e.Property(u => u.CreatedAt).IsRequired().HasDefaultValueSql("now()").ValueGeneratedOnAdd();
        });

        modelBuilder.Entity<Project>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(p => p.Name).IsRequired().HasMaxLength(512);
            e.Property(p => p.CreatedAt).IsRequired().HasDefaultValueSql("now()").ValueGeneratedOnAdd();

            e.HasOne(p => p.Owner)
             .WithMany(u => u.Projects)
             .HasForeignKey(p => p.OwnerId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProjectTask>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(t => t.Title).IsRequired().HasMaxLength(512);
            e.Property(t => t.CreatedAt).IsRequired().HasDefaultValueSql("now()").ValueGeneratedOnAdd();

            e.HasOne(t => t.Project)
             .WithMany(p => p.Tasks)
             .HasForeignKey(t => t.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(t => t.Parent)
             .WithMany(t => t.Children)
             .HasForeignKey(t => t.ParentId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.Restrict);
        });
    }
}