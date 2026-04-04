using AutoMapper;
using GanttApp.Core.DTOs;
using GanttApp.Core.Entities;
using GanttApp.Core.Interfaces;

namespace GanttApp.Infrastructure.Services;

public class SchedulerService(
    IProjectTaskRepository taskRepository,
    ITaskDependencyRepository dependencyRepository,
    IMapper mapper
) : ISchedulerService
{
    private readonly IProjectTaskRepository _taskRepository = taskRepository;
    private readonly ITaskDependencyRepository _dependencyRepository = dependencyRepository;
    private readonly IMapper _mapper = mapper;

    public async Task<IEnumerable<TaskDto>> CascadeTaskDatesAsync(
        Guid projectId,
        Guid changedTaskId
    )
    {
        // Load everything upfront — two queries, no N+1 inside the algorithm
        var allTasks = (await _taskRepository.GetByProjectIdAsync(projectId)).ToDictionary(t =>
            t.Id
        );

        var allDependencies = await _dependencyRepository.GetByProjectIdAsync(projectId);

        // Build adjacency list: predecessorId → list of successorIds
        var adjacency = new Dictionary<Guid, List<Guid>>();
        foreach (var dep in allDependencies)
        {
            if (!adjacency.TryGetValue(dep.PredecessorId, out var successors))
            {
                successors = [];
                adjacency[dep.PredecessorId] = successors;
            }
            successors.Add(dep.SuccessorId);
        }

        // Build reverse map: successorId → list of predecessorIds (needed to calculate newStart)
        var predecessorMap = new Dictionary<Guid, List<Guid>>();
        foreach (var dep in allDependencies)
        {
            if (!predecessorMap.TryGetValue(dep.SuccessorId, out var predecessors))
            {
                predecessors = [];
                predecessorMap[dep.SuccessorId] = predecessors;
            }
            predecessors.Add(dep.PredecessorId);
        }

        var visited = new HashSet<Guid>();
        var stack = new Stack<Guid>();

        void Dfs(Guid taskId)
        {
            if (!visited.Add(taskId))
                return;

            if (adjacency.TryGetValue(taskId, out var successors))
                foreach (var successorId in successors)
                    Dfs(successorId);

            stack.Push(taskId);
        }

        Dfs(changedTaskId);

        // Pop in order — first item is changedTaskId itself, skip it
        var orderedSuccessors = new List<Guid>();
        while (stack.Count > 0)
        {
            var id = stack.Pop();
            if (id != changedTaskId)
                orderedSuccessors.Add(id);
        }

        // Cascade dates through the ordered successors
        var modifiedTasks = new List<ProjectTask>();
        foreach (var taskId in orderedSuccessors)
        {
            if (!allTasks.TryGetValue(taskId, out var task))
                continue;

            var taskPredecessors = predecessorMap.GetValueOrDefault(taskId, []);
            if (taskPredecessors.Count == 0)
                continue;

            var latestPredecessorEnd = taskPredecessors
                .Where(allTasks.ContainsKey)
                .Max(pId => allTasks[pId].EndDate);

            var duration = task.EndDate - task.StartDate;
            task.StartDate = latestPredecessorEnd.AddDays(1);
            task.EndDate = task.StartDate + duration;

            // Update in-memory dict so subsequent successors see the shifted date
            allTasks[taskId] = task;
            modifiedTasks.Add(task);
        }

        // Persist all changes
        foreach (var task in modifiedTasks)
            await _taskRepository.UpdateAsync(task);

        return _mapper.Map<IEnumerable<TaskDto>>(modifiedTasks);
    }
}
