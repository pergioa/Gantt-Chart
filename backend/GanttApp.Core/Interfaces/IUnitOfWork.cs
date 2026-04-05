namespace GanttApp.Core.Interfaces;

public interface IUnitOfWork : IAsyncDisposable
{
    Task BeginTransactionAsync();
    Task CommitAsync();
    Task RollbackAsync();
    Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> operation);
}
