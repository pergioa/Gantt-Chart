import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ProjectService } from '../../../core/services/projectService';
import { Project } from '../../../core/models/project.model';

@Component({
  selector: 'app-project-list',
  imports: [AsyncPipe, RouterLink],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList {
  private readonly projectService = inject(ProjectService);
  projects$: Observable<Project[]> = this.projectService.getAll();

  deleteProject(id: string): void {
    this.projectService.delete(id).subscribe(()=>this.projects$ =  this.projectService.getAll());
  }
}
