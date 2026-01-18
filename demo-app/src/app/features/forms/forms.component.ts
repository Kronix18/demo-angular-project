import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  country: string;
  agree: boolean;
}

@Component({
  selector: 'app-forms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forms.component.html',
  styleUrl: './forms.component.scss'
})
export class FormsComponent {
  formData: FormData = {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: '',
    agree: false
  };

  submitted = false;

  get passwordMismatch(): boolean {
    return this.formData.password !== this.formData.confirmPassword &&
           this.formData.confirmPassword.length > 0;
  }

  handleSubmit(form: NgForm): void {
    if (form.valid && !this.passwordMismatch) {
      this.submitted = true;
      console.log('Form submitted:', this.formData);
    }
  }

  handleReset(form: NgForm): void {
    form.resetForm();
    this.submitted = false;
    this.formData = {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      country: '',
      agree: false
    };
  }
}
