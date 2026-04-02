import { Routes } from '@angular/router';
import { Placeholder } from './shared/components/placeholder/placeholder';
import { ProjectList } from './features/projects/project-list/project-list';
import { ProjectForm } from './features/projects/project-form/project-form';
import { ProjectDetail } from './features/projects/project-detail/project-detail';

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'login', component: Placeholder },
    { path: 'register', component: Placeholder },
    { path: 'dashboard', component: ProjectList },
    { path: 'projects/new', component: ProjectForm },
    { path: 'projects/:id/edit', component: ProjectForm },
    { path: 'projects/:id', component: ProjectDetail },
];
