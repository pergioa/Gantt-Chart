using GanttApp.Core.Interfaces;
using Microsoft.EntityFrameworkCore.Storage;

namespace GanttApp.Infrastructure;

public class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    private readonly AppDbContext _context = context;
    private IDbContextTransaction? _transaction;

    public async Task BeginTransactionAsync()
    {
        _transaction = await _context.Database.BeginTransactionAsync();
    }

    public Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> operation)
    {
        var strategy = _context.Database.CreateExecutionStrategy();
        return strategy.ExecuteAsync<object?, T>(
            state: null,
            operation: async (_, _, ct) =>
            {
                await using var tx = await _context.Database.BeginTransactionAsync(ct);
                try
                {
                    var result = await operation();
                    await tx.CommitAsync(ct);
                    return result;
                }
                catch
                {
                    await tx.RollbackAsync(ct);
                    throw;
                }
            },
            verifySucceeded: null,
            cancellationToken: CancellationToken.None
        );
    }

    public async Task CommitAsync()
    {
        if (_transaction is null)
            return;
        await _transaction.CommitAsync();
    }

    public async Task RollbackAsync()
    {
        if (_transaction is null)
            return;
        await _transaction.RollbackAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (_transaction is not null)
            await _transaction.DisposeAsync();
    }
}
