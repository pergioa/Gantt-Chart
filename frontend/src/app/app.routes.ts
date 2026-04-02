import { Routes } from '@angular/router';
import { ProjectList } from './features/projects/project-list/project-list';
import { ProjectForm } from './features/projects/project-form/project-form';
import { ProjectDetail } from './features/projects/project-detail/project-detail';
import { TaskForm } from './features/projects/task-form/task-form';
import { authGuard } from './core/auth/auth.guard';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'dashboard', component: ProjectList, canActivate: [authGuard] },
  { path: 'projects/new', component: ProjectForm, canActivate: [authGuard] },
  { path: 'projects/:id/edit', component: ProjectForm, canActivate: [authGuard] },
  { path: 'projects/:id', component: ProjectDetail, canActivate: [authGuard] },
  { path: 'projects/:id/tasks/new', component: TaskForm, canActivate: [authGuard] },
];
