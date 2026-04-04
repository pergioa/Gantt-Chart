import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, switchMap, takeUntil } from 'rxjs';
import { FrappeTask } from '../../../core/models/frappe-task.model';
import { Task } from '../../../core/models/task.model';
import { ProjectService } from '../../../core/services/projectService';
import { BatchTaskPayload, TaskService } from '../../../core/services/taskService';
import { TaskMapper } from '../../../core/services/task-mapper';
import { GanttWrapper } from '../gantt-wrapper/gantt-wrapper';
import { GanttControls, ViewMode } from '../gantt-controls/gantt-controls';
import { TaskEditPanel } from '../task-edit-panel/task-edit-panel';

@Component({
  selector: 'app-gantt-page',
  imports: [GanttWrapper, GanttControls, TaskEditPanel],
  templateUrl: './gantt-page.html',
  styleUrl: './gantt-page.scss',
})
export class GanttPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);
  private readonly mapper = inject(TaskMapper);
  private readonly cdr = inject(ChangeDetectorRef);

  projectId = '';
  frappeTasks: FrappeTask[] = [];
  tasksLoaded = false;
  selectedTask: Task | null = null;

  get allTasksList(): Task[] {
    return this.getOrderedTasks();
  }
  @ViewChild(GanttWrapper) ganttWrapper?: GanttWrapper;
  private pendingInitialViewMode: ViewMode | null = 'Day';

  private taskMap = new Map<string, Task>();
  private pendingChanges = new Map<string, BatchTaskPayload>();
  private dragSubject = new Subject<void>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id')!;

    this.projectService.getTasks(this.projectId).subscribe((tasks) => {
      this.tasksLoaded = true;
      tasks.forEach((t) => this.taskMap.set(t.id, t));
      this.refreshChartTasks();
      this.cdr.detectChanges();
      this.applyInitialViewMode();
    });

    this.dragSubject
      .pipe(
        debounceTime(500),
        switchMap(() => {
          const payload = { tasks: Array.from(this.pendingChanges.values()) };
          return this.taskService.batchUpdate(this.projectId, payload);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((updatedTasks) => {
        updatedTasks.forEach((t) => this.taskMap.set(t.id, t));
        this.refreshChartTasks();
        this.pendingChanges.clear();
        this.cdr.detectChanges();
      });
  }

  onDateChanged(event: { task: FrappeTask; start: Date; end: Date }): void {
    const existing = this.taskMap.get(event.task.id);
    if (!existing) return;

    const drag = this.mapper.fromFrappeTask(event.task, event.start, event.end);
    this.pendingChanges.set(event.task.id, {
      id: existing.id,
      title: existing.title,
      parentId: existing.parentId,
      order: existing.order,
      dependencies: existing.dependencies,
      ...drag,
    });
    this.dragSubject.next();
  }

  onProgressChanged(event: { task: FrappeTask; progress: number }): void {
    const existing = this.taskMap.get(event.task.id);
    if (!existing) return;

    this.pendingChanges.set(event.task.id, {
      id: existing.id,
      title: existing.title,
      parentId: existing.parentId,
      order: existing.order,
      dependencies: existing.dependencies,
      startDate: existing.startDate,
      endDate: existing.endDate,
      progress: event.progress,
    });
    this.dragSubject.next();
  }

  onTaskClicked(ft: FrappeTask): void {
    this.selectedTask = this.taskMap.get(ft.id) ?? null;
  }

  onPanelSaved(updated: Task): void {
    this.taskMap.set(updated.id, updated);
    this.refreshChartTasks();
    this.selectedTask = null;
  }

  onPanelDeleted(taskId: string): void {
    this.taskMap.delete(taskId);
    this.pendingChanges.delete(taskId);

    // Strip the deleted task from any other task's dependency list in memory
    for (const [id, task] of this.taskMap) {
      const filtered = task.dependencies.filter((d) => d.predecessorId !== taskId);
      if (filtered.length !== task.dependencies.length) {
        this.taskMap.set(id, { ...task, dependencies: filtered });
      }
    }

    this.refreshChartTasks();
    this.selectedTask = null;
    this.cdr.detectChanges();
  }

  onViewModeChanged(mode: ViewMode): void {
    this.pendingInitialViewMode = mode;
    this.ganttWrapper?.setViewMode(mode);
  }

  onAddTask(): void {
    this.router.navigate(['/projects', this.projectId, 'tasks', 'new']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private applyInitialViewMode(): void {
    if (!this.pendingInitialViewMode) {
      return;
    }

    queueMicrotask(() => {
      setTimeout(() => {
        this.ganttWrapper?.setViewMode(this.pendingInitialViewMode!);
      });
    });
  }

  private refreshChartTasks(): void {
    this.frappeTasks = this.getOrderedTasks().map((task) => this.mapper.toFrappeTask(task));
  }

  private getOrderedTasks(): Task[] {
    const tasks = Array.from(this.taskMap.values());
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const incomingCounts = new Map<string, number>();
    const successors = new Map<string, Task[]>();
    const rendered = new Set<string>();
    const ordered: Task[] = [];

    for (const task of tasks) {
      incomingCounts.set(task.id, 0);
      successors.set(task.id, []);
    }

    for (const task of tasks) {
      for (const dependency of task.dependencies) {
        if (!tasksById.has(dependency.predecessorId)) {
          continue;
        }

        incomingCounts.set(task.id, (incomingCounts.get(task.id) ?? 0) + 1);
        successors.get(dependency.predecessorId)?.push(task);
      }
    }

    const sortTasks = (left: Task, right: Task): number => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.title.localeCompare(right.title);
    };

    for (const list of successors.values()) {
      list.sort(sortTasks);
    }

    const ready = tasks
      .filter((task) => (incomingCounts.get(task.id) ?? 0) === 0)
      .sort(sortTasks);

    const visit = (task: Task): void => {
      if (rendered.has(task.id)) {
        return;
      }

      rendered.add(task.id);
      ordered.push(task);

      for (const successor of successors.get(task.id) ?? []) {
        const nextCount = (incomingCounts.get(successor.id) ?? 0) - 1;
        incomingCounts.set(successor.id, nextCount);

        if (nextCount === 0) {
          visit(successor);
        }
      }
    };

    for (const task of ready) {
      visit(task);
    }

    for (const task of tasks.sort(sortTasks)) {
      if (!rendered.has(task.id)) {
        visit(task);
      }
    }

    return ordered;
  }
}
