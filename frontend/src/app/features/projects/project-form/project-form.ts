import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../../core/services/projectService';
import { CreateProject, UpdateProject } from '../../../core/models/project.model';

@Component({
  selector: 'app-project-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './project-form.html',
  styleUrl: './project-form.scss',
})
export class ProjectForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isEditMode = false;
  private projectId: string | null = null;

  form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.projectId;

    if (this.isEditMode && this.projectId) {
      this.projectService.getById(this.projectId).subscribe((project) => {
        this.form.patchValue({ name: project.name, description: project.description });
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const { name, description } = this.form.value;
    if (this.isEditMode) {
      const updateDto: UpdateProject = { name: name!, description: description ?? '' };
      this.projectService
        .update(this.projectId as string, updateDto)
        .subscribe(() => this.router.navigate(['/dashboard']));
    } else {
      const createDto: CreateProject = {
        name: name!,
        description: description ?? '',
      };
      this.projectService.create(createDto).subscribe(() => this.router.navigate(['/dashboard']));
    }
  }
}
