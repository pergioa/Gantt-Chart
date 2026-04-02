import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../../core/services/projectService';
import { CreateTask } from '../../../core/models/task.model';

@Component({
  selector: 'app-task-form',
  imports: [ReactiveFormsModule, RouterLink],
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
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
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
      startDate: startDate!,
      endDate: endDate!,
      progress: progress!,
      parentId: null,
      order: 0,
    };
    
    this.projectService
      .createTask(this.projectId, taskDto)
      .subscribe(() => this.router.navigate(['/projects', this.projectId]));
  }
}
