import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';
import { ProjectService } from '../../../core/services/projectService';
import { TaskService } from '../../../core/services/taskService';
import { Project } from '../../../core/models/project.model';
import { Task } from '../../../core/models/task.model';

@Component({
  selector: 'app-project-detail',
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);

  project: Project | null = null;
  private projectId!: string;
  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  tasks$ = this.refresh$.pipe(switchMap(() => this.projectService.getTasks(this.projectId)));

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id') as string;
    this.projectService.getById(this.projectId).subscribe((project) => this.project = project);
  }

  deleteTask(taskId: string): void {
    this.taskService.delete(taskId).subscribe(() => this.refresh$.next());
  }

  onAddTask(): void {
    this.router.navigate(['/projects',this.projectId,'tasks','new']);
  }
}
