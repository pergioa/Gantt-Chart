import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { ProjectService } from '../../../core/services/projectService';
import { Project } from '../../../core/models/project.model';
import { Task } from '../../../core/models/task.model';
import { TaskService } from '../../../core/services/taskService';

@Component({
  selector: 'app-project-detail',
  imports: [AsyncPipe, RouterLink],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);

  project: Project | null = null;
  tasks$!: Observable<Task[]>;

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('id') as string;
    this.projectService.getById(projectId).subscribe((project)=> this.project = project);
    this.tasks$ = this.projectService.getTasks(projectId);
  }

  deleteTask(taskId: string): void {
    this.taskService.delete(taskId).subscribe(()=> this.tasks$ = this.projectService.getTasks(this.project?.id as string))
  }

  onAddTask(): void {
    // wired in Phase 3
  }
}
