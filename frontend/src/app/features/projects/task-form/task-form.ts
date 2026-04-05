import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  ReactiveFormsModule,
  FormBuilder,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../../core/services/projectService';
import { CreateTask, DependencyType, Task } from '../../../core/models/task.model';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-task-form',
  imports: [ReactiveFormsModule, RouterLink, DatePicker, CommonModule],
  templateUrl: './task-form.html',
  styleUrl: './task-form.scss',
})
export class TaskForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  projectId!: string;
  availableTasks: Task[] = [];
  selectedDependencies = new Map<string, DependencyType>();
  dependencySearch = '';

  readonly dependencyTypes: DependencyType[] = ['FinishToStart', 'StartToStart', 'FinishToFinish'];

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(50)]],
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null, Validators.required],
    progress: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  }, { validators: [(control) => this.validateSchedule(control)] });

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') as string;
    this.projectService.getTasks(this.projectId).subscribe((tasks) => {
      this.availableTasks = tasks;
      this.refreshValidation();
      this.cdr.detectChanges();
    });
  }

  get filteredAvailableTasks(): Task[] {
    const query = this.dependencySearch.trim().toLowerCase();
    if (!query) return this.availableTasks;
    return this.availableTasks.filter((t) => t.title.toLowerCase().includes(query));
  }

  onDependencySearch(event: Event): void {
    this.dependencySearch = (event.target as HTMLInputElement).value;
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

    this.applyDependencyDateDefaults();
    this.refreshValidation();
  }

  setDependencyType(taskId: string, type: DependencyType): void {
    if (this.selectedDependencies.has(taskId)) {
      this.selectedDependencies.set(taskId, type);
    }

    this.applyDependencyDateDefaults();
    this.refreshValidation();
  }

  get scheduleErrors(): string[] {
    const errors = this.form.errors;
    if (!errors) {
      return [];
    }

    const messages: string[] = [];

    if (errors['dateOrder']) {
      messages.push('End date cannot be earlier than the start date.');
    }

    const dependencyRules = errors['dependencyRules'] as string[] | undefined;
    if (dependencyRules?.length) {
      messages.push(...dependencyRules);
    }

    return messages;
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const { title, startDate, endDate, progress } = this.form.value;
    const taskDto: CreateTask = {
      title: title!,
      startDate: this.formatDate(startDate!),
      endDate: this.formatDate(endDate!),
      progress: progress!,
      parentId: null,
      order: 0,
      dependencies: Array.from(this.selectedDependencies.entries()).map(([predecessorId, type]) => ({
        predecessorId,
        type,
      })),
    };

    this.projectService
      .createTask(this.projectId, taskDto)
      .subscribe(() => this.router.navigate(['/projects', this.projectId]));
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

  private applyDependencyDateDefaults(): void {
    const startControl = this.form.controls.startDate;
    const endControl = this.form.controls.endDate;
    const currentStart = startControl.value;
    const currentEnd = endControl.value;
    const shouldUpdateStart = !startControl.dirty;
    const shouldUpdateEnd = !endControl.dirty;

    if (!shouldUpdateStart && !shouldUpdateEnd) {
      return;
    }

    let suggestedStart: Date | null = null;
    let suggestedEnd: Date | null = null;

    for (const [taskId, type] of this.selectedDependencies.entries()) {
      const predecessor = this.availableTasks.find((task) => task.id === taskId);
      if (!predecessor) {
        continue;
      }

      const predecessorStart = this.parseDate(predecessor.startDate);
      const predecessorEnd = this.parseDate(predecessor.endDate);

      if (type === 'FinishToStart') {
        suggestedStart = this.maxDate(suggestedStart, this.addDays(predecessorEnd, 1));
      }

      if (type === 'StartToStart') {
        suggestedStart = this.maxDate(suggestedStart, predecessorStart);
      }

      if (type === 'FinishToFinish') {
        suggestedEnd = this.maxDate(suggestedEnd, predecessorEnd);
      }
    }

    const nextStart = shouldUpdateStart ? suggestedStart : currentStart;
    const baselineStart = nextStart ?? currentStart;
    const nextEnd = shouldUpdateEnd ? this.maxDate(suggestedEnd, baselineStart) : currentEnd;

    this.form.patchValue(
      {
        startDate: nextStart ?? currentStart,
        endDate: nextEnd ?? currentEnd,
      },
      { emitEvent: false },
    );

    this.form.updateValueAndValidity({ emitEvent: false });
    this.cdr.detectChanges();
  }

  private maxDate(left: Date | null, right: Date | null): Date | null {
    if (!left) {
      return right;
    }

    if (!right) {
      return left;
    }

    return left.getTime() >= right.getTime() ? left : right;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('T')[0].split('-').map((part) => Number(part));
    return new Date(year, month - 1, day);
  }

  private validateSchedule(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('startDate')?.value as Date | null;
    const endDate = control.get('endDate')?.value as Date | null;

    if (!startDate || !endDate) {
      return null;
    }

    const errors: ValidationErrors = {};

    if (startDate.getTime() > endDate.getTime()) {
      errors['dateOrder'] = true;
    }

    const dependencyRules: string[] = [];

    for (const [taskId, type] of this.selectedDependencies.entries()) {
      const predecessor = this.availableTasks.find((task) => task.id === taskId);
      if (!predecessor) {
        continue;
      }

      const predecessorStart = this.parseDate(predecessor.startDate);
      const predecessorEnd = this.parseDate(predecessor.endDate);
      const predecessorLabel = `"${predecessor.title}"`;

      if (type === 'FinishToStart' && startDate.getTime() <= predecessorEnd.getTime()) {
        dependencyRules.push(
          `Start date must be after ${predecessorLabel} end date for ${type}.`,
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
