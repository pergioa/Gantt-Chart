import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DependencyType, Task, TaskDependencyItem, UpdateTask } from '../../../core/models/task.model';
import { TaskService } from '../../../core/services/taskService';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';

@Component({
  selector: 'app-task-edit-panel',
  imports: [ReactiveFormsModule, CommonModule, DatePicker],
  templateUrl: './task-edit-panel.html',
  styleUrl: './task-edit-panel.scss',
})
export class TaskEditPanel implements OnChanges {
  @Input() task: Task | null = null;
  @Input() allTasks: Task[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Task>();
  @Output() deleted = new EventEmitter<string>();

  private readonly fb = inject(FormBuilder);
  private readonly taskService = inject(TaskService);

  selectedDependencies = new Map<string, DependencyType>();
  deleteWarningTasks: Task[] = [];
  showDeleteConfirm = false;

  readonly dependencyTypes: DependencyType[] = ['FinishToStart', 'StartToStart', 'FinishToFinish'];

  form = this.fb.group({
    title: ['', Validators.required],
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null, Validators.required],
    progress: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  }, { validators: [(control) => this.validateSchedule(control)] });

  get otherTasks(): Task[] {
    return this.allTasks.filter((t) => t.id !== this.task?.id);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task) {
      this.form.patchValue({
        title: this.task.title,
        startDate: new Date(this.task.startDate),
        endDate: new Date(this.task.endDate),
        progress: this.task.progress,
      });
      this.selectedDependencies = new Map(
        this.task.dependencies.map((d) => [d.predecessorId, d.type]),
      );
      this.refreshValidation();
    }
  }

  isSelected(taskId: string): boolean {
    return this.selectedDependencies.has(taskId);
  }

  toggleDependency(taskId: string): void {
    if (this.selectedDependencies.has(taskId)) {
      this.selectedDependencies.delete(taskId);
    } else {
      this.selectedDependencies.set(taskId, 'FinishToStart');
    }

    this.refreshValidation();
  }

  setDependencyType(taskId: string, type: DependencyType): void {
    if (this.selectedDependencies.has(taskId)) {
      this.selectedDependencies.set(taskId, type);
    }

    this.refreshValidation();
  }

  get scheduleErrors(): string[] {
    const errors = this.form.errors;
    if (!errors) {
      return [];
    }

    const messages: string[] = [];

    if (errors['dateOrder']) {
      messages.push('End date must be later than the start date.');
    }

    const dependencyRules = errors['dependencyRules'] as string[] | undefined;
    if (dependencyRules?.length) {
      messages.push(...dependencyRules);
    }

    return messages;
  }

  getDependencies(): TaskDependencyItem[] {
    return Array.from(this.selectedDependencies.entries()).map(([predecessorId, type]) => ({
      predecessorId,
      type,
    }));
  }

  onSave(): void {
    if (this.form.invalid || !this.task) return;

    const { title, startDate, endDate, progress } = this.form.value;
    const dto: UpdateTask = {
      title: title!,
      startDate: this.formatDate(startDate!),
      endDate: this.formatDate(endDate!),
      progress: progress!,
      parentId: this.task.parentId,
      order: this.task.order,
      dependencies: this.getDependencies(),
    };

    this.taskService.update(this.task.id, dto).subscribe((updated) => {
      this.saved.emit(updated);
    });
  }

  onDelete(): void {
    if (!this.task) return;

    const taskId = this.task.id;
    this.deleteWarningTasks = this.allTasks.filter((t) =>
      t.dependencies.some((d) => d.predecessorId === taskId),
    );

    if (this.deleteWarningTasks.length > 0) {
      this.showDeleteConfirm = true;
      return;
    }

    this.confirmDelete();
  }

  confirmDelete(): void {
    if (!this.task) return;
    const taskId = this.task.id;
    this.showDeleteConfirm = false;
    this.taskService.delete(taskId).subscribe(() => {
      this.deleted.emit(taskId);
    });
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.deleteWarningTasks = [];
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private refreshValidation(): void {
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private validateSchedule(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('startDate')?.value as Date | null;
    const endDate = control.get('endDate')?.value as Date | null;

    if (!startDate || !endDate) {
      return null;
    }

    const errors: ValidationErrors = {};

    if (startDate.getTime() >= endDate.getTime()) {
      errors['dateOrder'] = true;
    }

    const dependencyRules: string[] = [];

    for (const [taskId, type] of this.selectedDependencies.entries()) {
      const predecessor = this.otherTasks.find((task) => task.id === taskId);
      if (!predecessor) {
        continue;
      }

      const predecessorStart = new Date(predecessor.startDate);
      const predecessorEnd = new Date(predecessor.endDate);
      const predecessorLabel = `"${predecessor.title}"`;

      if (type === 'FinishToStart' && startDate.getTime() < predecessorEnd.getTime()) {
        dependencyRules.push(
          `Start date must be on or after ${predecessorLabel} end date for ${type}.`,
        );
      }

      if (type === 'StartToStart' && startDate.getTime() < predecessorStart.getTime()) {
        dependencyRules.push(
          `Start date must be on or after ${predecessorLabel} start date for ${type}.`,
        );
      }

      if (type === 'FinishToFinish' && endDate.getTime() < predecessorEnd.getTime()) {
        dependencyRules.push(
          `End date must be on or after ${predecessorLabel} end date for ${type}.`,
        );
      }
    }

    if (dependencyRules.length) {
      errors['dependencyRules'] = dependencyRules;
    }

    return Object.keys(errors).length ? errors : null;
  }
}
