import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { FrappeTask } from '../../../core/models/frappe-task.model';
import { Task } from '../../../core/models/task.model';
import { ProjectService } from '../../../core/services/projectService';
import { BatchTaskPayload, TaskService } from '../../../core/services/taskService';
import { TaskMapper } from '../../../core/services/task-mapper';
import { GanttWrapper } from '../gantt-wrapper/gantt-wrapper';
import { GanttControls, ViewMode } from '../gantt-controls/gantt-controls';
import { TaskEditPanel, TaskEditSaveEvent } from '../task-edit-panel/task-edit-panel';

type GanttDateChangeEvent = { task: FrappeTask; start: Date; end: Date };

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
  private persistedTaskMap = new Map<string, Task>();
  private pendingChanges = new Map<string, BatchTaskPayload>();
  private destroy$ = new Subject<void>();
  private readonly debugLoggingEnabled = true;

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id')!;

    this.projectService.getTasks(this.projectId).subscribe((tasks) => {
      this.tasksLoaded = true;
      this.persistedTaskMap = this.createTaskMap(tasks);
      this.taskMap = this.cloneTaskMap(this.persistedTaskMap);
      this.refreshChartTasks();
      this.cdr.detectChanges();
      this.applyInitialViewMode();
    });
  }

  onDateDragging(events: GanttDateChangeEvent[]): void {
    this.applyDateChanges(events, false, false);
  }

  onDateChanged(events: GanttDateChangeEvent[]): void {
    this.applyDateChanges(events, true, true);
  }

  onProgressChanged(event: { task: FrappeTask; progress: number }): void {
    const existing = this.taskMap.get(event.task.id);
    if (!existing) return;

    const updatedTask: Task = {
      ...existing,
      progress: event.progress,
    };

    this.taskMap.set(updatedTask.id, updatedTask);
    this.pendingChanges.set(updatedTask.id, this.toBatchPayload(updatedTask));
    this.refreshChartTasks();
    this.syncSelectedTask();
    this.cdr.detectChanges();
  }

  onTaskClicked(ft: FrappeTask): void {
    this.selectedTask = this.taskMap.get(ft.id) ?? null;
  }

  onPanelSaved(event: TaskEditSaveEvent): void {
    const existing = this.taskMap.get(event.id);
    if (!existing) {
      return;
    }

    const updatedTask: Task = {
      ...existing,
      ...event.changes,
    };

    this.taskMap.set(updatedTask.id, updatedTask);
    this.pendingChanges.set(updatedTask.id, this.toBatchPayload(updatedTask));
    this.propagateSuccessorSchedules(new Set([updatedTask.id]), true);
    this.refreshChartTasks();
    this.syncSelectedTask();
    this.cdr.detectChanges();

    const payload = { tasks: Array.from(this.pendingChanges.values()) };
    this.debugLog('onPanelSaved:batchUpdate:start', {
      changedTaskId: event.id,
      pendingTasks: payload.tasks.map((task) => task.id),
    });
    this.taskService.batchUpdate(this.projectId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe((updatedTasks) => {
        this.debugLog('onPanelSaved:batchUpdate:success', {
          updatedTaskIds: updatedTasks.map((task) => task.id),
          selectedTaskId: this.selectedTask?.id ?? null,
        });
        for (const task of updatedTasks) {
          this.persistedTaskMap.set(task.id, this.cloneTask(task));
        }
        this.taskMap = this.cloneTaskMap(this.persistedTaskMap);
        this.pendingChanges.clear();
        this.ganttWrapper?.recenterToToday();
        this.refreshChartTasks();
        this.selectedTask = null;
        this.cdr.detectChanges();
        queueMicrotask(() => {
          requestAnimationFrame(() => {
            this.debugLog('onPanelSaved:scrollToTodayNow', {
              hasWrapper: Boolean(this.ganttWrapper),
            });
            this.ganttWrapper?.scrollToTodayNow();
          });
        });
      });
  }

  onPanelClosed(): void {
    if (this.pendingChanges.size) {
      this.taskMap = this.cloneTaskMap(this.persistedTaskMap);
      this.pendingChanges.clear();
      this.refreshChartTasks();
    }

    this.selectedTask = null;
    this.cdr.detectChanges();
  }

  onPanelDeleted(taskId: string): void {
    this.taskMap.delete(taskId);
    this.persistedTaskMap.delete(taskId);
    this.pendingChanges.delete(taskId);

    // Strip the deleted task from any other task's dependency list in memory
    for (const [id, task] of this.taskMap) {
      const filtered = task.dependencies.filter((d) => d.predecessorId !== taskId);
      if (filtered.length !== task.dependencies.length) {
        this.taskMap.set(id, { ...task, dependencies: filtered });
        const persistedTask = this.persistedTaskMap.get(id);
        if (persistedTask) {
          this.persistedTaskMap.set(id, { ...persistedTask, dependencies: filtered });
        }
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

  private applyDateChanges(
    events: GanttDateChangeEvent[],
    persist: boolean,
    refreshChart: boolean,
  ): void {
    if (!events.length) {
      return;
    }

    const changedTaskIds = new Set<string>();

    for (const event of events) {
      const existing = this.taskMap.get(event.task.id);
      if (!existing) {
        continue;
      }

      const drag = this.mapper.fromFrappeTask(event.task, event.start, event.end);
      const updatedTask: Task = {
        ...existing,
        ...drag,
      };

      if (
        updatedTask.startDate === existing.startDate
        && updatedTask.endDate === existing.endDate
      ) {
        continue;
      }

      this.taskMap.set(updatedTask.id, updatedTask);
      changedTaskIds.add(updatedTask.id);

      if (persist) {
        this.pendingChanges.set(updatedTask.id, this.toBatchPayload(updatedTask));
      }
    }

    if (!changedTaskIds.size) {
      return;
    }

    this.propagateSuccessorSchedules(changedTaskIds, persist);
    if (refreshChart) {
      this.refreshChartTasks();
    }
    this.syncSelectedTask();
    this.cdr.detectChanges();
  }

  private propagateSuccessorSchedules(changedTaskIds: Set<string>, persist: boolean): void {
    const successors = this.buildSuccessorMap();
    const queue = Array.from(changedTaskIds);
    const queued = new Set(queue);
    const visitCounts = new Map<string, number>();
    const maxVisitsPerTask = Math.max(1, this.taskMap.size);

    while (queue.length) {
      const currentId = queue.shift()!;
      queued.delete(currentId);
      const downstreamTasks = successors.get(currentId) ?? [];

      for (const successor of downstreamTasks) {
        if (changedTaskIds.has(successor.id)) {
          continue;
        }

        const existing = this.taskMap.get(successor.id);
        if (!existing) {
          continue;
        }

        const propagated = this.calculatePropagatedTask(existing);
        if (!propagated) {
          continue;
        }

        this.debugLog('propagateSuccessorSchedules:final-propagated', {
          taskId: propagated.id,
          startDate: propagated.startDate,
          endDate: propagated.endDate,
          triggeredBy: currentId,
        });
        this.taskMap.set(propagated.id, propagated);
        if (persist) {
          this.pendingChanges.set(propagated.id, this.toBatchPayload(propagated));
        }

        const nextVisitCount = (visitCounts.get(propagated.id) ?? 0) + 1;
        visitCounts.set(propagated.id, nextVisitCount);

        if (nextVisitCount < maxVisitsPerTask && !queued.has(propagated.id)) {
          queue.push(propagated.id);
          queued.add(propagated.id);
        }
      }
    }
  }

  private buildSuccessorMap(): Map<string, Task[]> {
    const successors = new Map<string, Task[]>();

    for (const task of this.taskMap.values()) {
      successors.set(task.id, []);
    }

    for (const task of this.taskMap.values()) {
      for (const dependency of task.dependencies) {
        successors.get(dependency.predecessorId)?.push(task);
      }
    }

    return successors;
  }

  private calculatePropagatedTask(task: Task): Task | null {
    const originalStart = this.parseTaskDate(task.startDate);
    const originalEnd = this.parseTaskDate(task.endDate);
    let minStart = originalStart;
    let minEnd = originalEnd;

    for (const dependency of task.dependencies) {
      const predecessor = this.taskMap.get(dependency.predecessorId);
      if (!predecessor) {
        continue;
      }

      const predecessorStart = this.parseTaskDate(predecessor.startDate);
      const predecessorEnd = this.parseTaskDate(predecessor.endDate);

      if (dependency.type === 'FinishToStart') {
        minStart = this.maxDate(minStart, this.addDays(predecessorEnd, 1));
      }

      if (dependency.type === 'StartToStart') {
        minStart = this.maxDate(minStart, predecessorStart);
      }

      if (dependency.type === 'FinishToFinish') {
        minEnd = this.maxDate(minEnd, predecessorEnd);
      }
    }

    const durationDays = this.getInclusiveDurationDays(task.startDate, task.endDate);
    if (this.sameDay(minStart, originalStart) && this.sameDay(minEnd, originalEnd)) {
      return null;
    }

    let nextStart = minStart;
    let nextEnd = this.addDays(nextStart, Math.max(durationDays - 1, 0));
    if (nextEnd.getTime() < minEnd.getTime()) {
      nextEnd = minEnd;
      nextStart = this.addDays(nextEnd, -Math.max(durationDays - 1, 0));
    }

    return {
      ...task,
      startDate: this.formatDate(nextStart),
      endDate: this.formatDate(nextEnd),
    };
  }

  private toBatchPayload(task: Task): BatchTaskPayload {
    return {
      id: task.id,
      title: task.title,
      parentId: task.parentId,
      order: task.order,
      dependencies: task.dependencies,
      startDate: task.startDate,
      endDate: task.endDate,
      progress: task.progress,
    };
  }

  private createTaskMap(tasks: Task[]): Map<string, Task> {
    return new Map(tasks.map((task) => [task.id, this.cloneTask(task)]));
  }

  private cloneTaskMap(source: Map<string, Task>): Map<string, Task> {
    return new Map(Array.from(source.entries()).map(([id, task]) => [id, this.cloneTask(task)]));
  }

  private cloneTask(task: Task): Task {
    return {
      ...task,
      dependencies: task.dependencies.map((dependency) => ({ ...dependency })),
    };
  }

  private debugLog(event: string, payload: Record<string, unknown>): void {
    if (!this.debugLoggingEnabled) {
      return;
    }

    console.debug('[GanttPage]', event, payload);
  }

  private syncSelectedTask(): void {
    if (!this.selectedTask) {
      return;
    }

    this.selectedTask = this.taskMap.get(this.selectedTask.id) ?? null;
  }

  private parseTaskDate(value: string): Date {
    if (value.includes('T')) {
      return this.parseTaskDate(value.split('T')[0]);
    }

    const [year, month, day] = value.split('-').map((part) => Number(part));
    return new Date(year, month - 1, day);
  }

  private getInclusiveDurationDays(start: string, end: string): number {
    const startDate = this.parseTaskDate(start);
    const endDate = this.parseTaskDate(end);
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private maxDate(left: Date, right: Date): Date {
    return left.getTime() >= right.getTime() ? left : right;
  }

  private sameDay(left: Date, right: Date): boolean {
    return left.getTime() === right.getTime();
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
