import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/authService';

export const passwordMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  return group.get('password')?.value === group.get('confirmPassword')?.value ? null: {passwordMismatch: true};
};

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  form = this.fb.group(
    {
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatch },
  );

  errorMessage = '';

  onSubmit(): void {
    if (this.form.invalid) return;

    const { name, email, password } = this.form.value;
    this.authService.register({ name: name!, email: email!, password: password! }).subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => (this.errorMessage = 'Registration failed. Email may already be in use.'),
    });
  }
}
