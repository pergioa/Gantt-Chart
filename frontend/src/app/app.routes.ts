import { Routes } from '@angular/router';
import { Placeholder } from './shared/components/placeholder/placeholder';

export const routes: Routes = [
    {path:'',redirectTo: 'dashboard', pathMatch: 'full' },
    {path:'login',component:Placeholder},
    {path:'register',component:Placeholder},
    {path:'dashboard', component:Placeholder},
    {path:'projects/:id', component:Placeholder}
];
