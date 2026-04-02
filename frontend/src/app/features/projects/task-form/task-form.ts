import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../../core/services/projectService';
import { CreateTask } from '../../../core/models/task.model';
import { DatePicker } from '../../../shared/components/date-picker/date-picker';

@Component({
  selector: 'app-task-form',
  imports: [ReactiveFormsModule, RouterLink, DatePicker],
  templateUrl: './task-form.html',
  styleUrl: './task-form.scss',
})
export class TaskForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  projectId!: string;

  form = this.fb.group({
    title: ['', Validators.required],
    startDate: [null as Date | null, Validators.required],
    endDate: [null as Date | null, Validators.required],
    progress: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') as string;
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
