import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../../core/services/projectService';
import { CreateTask, Task } from '../../../core/models/task.model';
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

  projectId!: string;
  availableTasks: Task[] = [];
  selectedDependencies = new Set<string>();

  form = this.fb.group({
    title: ['', Validators.required],
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null, Validators.required],
    progress: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') as string;
    this.projectService.getTasks(this.projectId).subscribe((tasks) => {
      this.availableTasks = tasks;
    });
  }

  toggleDependency(taskId: string): void {
    if (this.selectedDependencies.has(taskId)) {
      this.selectedDependencies.delete(taskId);
    } else {
      this.selectedDependencies.add(taskId);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const { title, startDate, endDate, progress } = this.form.value;
    const taskDto: CreateTask = {
      title: title!,
      startDate: this.formatDate(startDate ?? null),
      endDate: this.formatDate(endDate ?? null),
      progress: progress!,
      parentId: null,
      order: 0,
      dependencies: Array.from(this.selectedDependencies),
    };

    this.projectService
      .createTask(this.projectId, taskDto)
      .subscribe(() => this.router.navigate(['/projects', this.projectId]));
  }

  private formatDate(date: Date | null): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
