import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Task, UpdateTask } from '../../../core/models/task.model';
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

  selectedDependencies = new Set<string>();

  form = this.fb.group({
    title: ['', Validators.required],
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null, Validators.required],
    progress: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

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
      this.selectedDependencies = new Set(this.task.dependencies);
    }
  }

  toggleDependency(taskId: string): void {
    if (this.selectedDependencies.has(taskId)) {
      this.selectedDependencies.delete(taskId);
    } else {
      this.selectedDependencies.add(taskId);
    }
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
      dependencies: Array.from(this.selectedDependencies),
    };

    this.taskService.update(this.task.id, dto).subscribe((updated) => {
      this.saved.emit(updated);
    });
  }

  onDelete(): void {
    if (!this.task) return;
    this.taskService.delete(this.task.id).subscribe(() => {
      this.deleted.emit(this.task!.id);
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
