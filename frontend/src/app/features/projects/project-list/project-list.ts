import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/authService';
import { ProjectService } from '../../../core/services/projectService';

@Component({
  selector: 'app-project-list',
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectList {
  private readonly authService = inject(AuthService);
  private readonly projectService = inject(ProjectService);
  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  projects$ = this.refresh$.pipe(switchMap(() => this.projectService.getAll()));

  deleteProject(id: string): void {
    this.projectService.delete(id).subscribe(() => this.refresh$.next());
  }

  logout(): void {
    this.authService.logout();
  }
}
