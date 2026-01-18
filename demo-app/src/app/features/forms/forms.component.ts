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
  template: `
    <div class="demo-container">
      <h2>Template-Driven Forms Demo</h2>

      <div class="section">
        <h3>User Registration Form</h3>
        
        <form #userForm="ngForm" (ngSubmit)="handleSubmit(userForm)">
          <div class="form-group">
            <label for="fullName">Full Name</label>
            <input 
              type="text"
              id="fullName"
              name="fullName"
              [(ngModel)]="formData.fullName"
              #fullNameField="ngModel"
              required
              minlength="3"
              placeholder="Enter your full name" />
            <span class="error" *ngIf="fullNameField.invalid && fullNameField.touched">
              <span *ngIf="fullNameField.errors?.['required']">Name is required</span>
              <span *ngIf="fullNameField.errors?.['minlength']">Name must be at least 3 characters</span>
            </span>
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <input 
              type="email"
              id="email"
              name="email"
              [(ngModel)]="formData.email"
              #emailField="ngModel"
              required
              email
              placeholder="Enter your email" />
            <span class="error" *ngIf="emailField.invalid && emailField.touched">
              <span *ngIf="emailField.errors?.['required']">Email is required</span>
              <span *ngIf="emailField.errors?.['email']">Invalid email format</span>
            </span>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input 
              type="password"
              id="password"
              name="password"
              [(ngModel)]="formData.password"
              #passwordField="ngModel"
              required
              minlength="6"
              placeholder="Enter password (min 6 chars)" />
            <span class="error" *ngIf="passwordField.invalid && passwordField.touched">
              <span *ngIf="passwordField.errors?.['required']">Password is required</span>
              <span *ngIf="passwordField.errors?.['minlength']">Password must be at least 6 characters</span>
            </span>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input 
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              [(ngModel)]="formData.confirmPassword"
              #confirmPasswordField="ngModel"
              required
              placeholder="Confirm password" />
            <span class="error" *ngIf="passwordMismatch && confirmPasswordField.touched">
              Passwords do not match
            </span>
          </div>

          <div class="form-group">
            <label for="country">Country</label>
            <select 
              id="country"
              name="country"
              [(ngModel)]="formData.country"
              #countryField="ngModel"
              required>
              <option value="">Select a country</option>
              <option value="usa">United States</option>
              <option value="canada">Canada</option>
              <option value="uk">United Kingdom</option>
              <option value="australia">Australia</option>
            </select>
            <span class="error" *ngIf="countryField.invalid && countryField.touched">
              Please select a country
            </span>
          </div>

          <div class="form-group checkbox">
            <label for="agree">
              <input 
                type="checkbox"
                id="agree"
                name="agree"
                [(ngModel)]="formData.agree"
                #agreeField="ngModel"
                required />
              I agree to the terms and conditions
            </label>
            <span class="error" *ngIf="agreeField.invalid && agreeField.touched">
              You must agree to continue
            </span>
          </div>

          <div class="button-group">
            <button type="submit" [disabled]="userForm.invalid || passwordMismatch">
              Submit
            </button>
            <button type="reset" (click)="handleReset(userForm)">
              Reset
            </button>
          </div>
        </form>
      </div>

      <div class="section" *ngIf="submitted">
        <h3>Form Data Summary</h3>
        <div class="success-message">
          Form submitted successfully!
        </div>
        <table class="data-table">
          <tr>
            <td><strong>Full Name:</strong></td>
            <td>{{ formData.fullName }}</td>
          </tr>
          <tr>
            <td><strong>Email:</strong></td>
            <td>{{ formData.email }}</td>
          </tr>
          <tr>
            <td><strong>Password:</strong></td>
            <td>{{ '•'.repeat(formData.password.length) }}</td>
          </tr>
          <tr>
            <td><strong>Country:</strong></td>
            <td>{{ formData.country }}</td>
          </tr>
          <tr>
            <td><strong>Agreed:</strong></td>
            <td>{{ formData.agree ? 'Yes' : 'No' }}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <h3>Form State Information</h3>
        <div class="info-box">
          <p><strong>Form Valid:</strong> <span [ngClass]="{'success': userForm.valid, 'error': !userForm.valid}">
            {{ userForm.valid ? 'Yes' : 'No' }}
          </span></p>
          <p><strong>Form Dirty:</strong> {{ userForm.dirty ? 'Yes' : 'No' }}</p>
          <p><strong>Form Touched:</strong> {{ userForm.touched ? 'Yes' : 'No' }}</p>
          <p><strong>Form Value:</strong></p>
          <pre>{{ userForm.value | json }}</pre>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .demo-container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .section {
      margin: 30px 0;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #f9f9f9;
    }

    h3 {
      margin-top: 0;
      color: #333;
    }

    .form-group {
      margin: 15px 0;
      display: flex;
      flex-direction: column;
    }

    .form-group.checkbox {
      flex-direction: row;
      align-items: center;
    }

    .form-group.checkbox label {
      display: flex;
      align-items: center;
      margin: 0;
    }

    .form-group.checkbox input {
      margin-right: 8px;
      width: auto;
    }

    label {
      margin-bottom: 5px;
      font-weight: bold;
      color: #333;
    }

    input, select {
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      transition: all 0.3s ease;
    }

    input:focus, select:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
    }

    input.ng-invalid.ng-touched {
      border-color: #dc3545;
      background: #fff5f5;
    }

    input.ng-valid.ng-touched {
      border-color: #28a745;
      background: #f5fff5;
    }

    .error {
      color: #dc3545;
      font-size: 12px;
      margin-top: 5px;
    }

    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }

    button {
      flex: 1;
      padding: 10px 20px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    button:hover:not(:disabled) {
      background: #0056b3;
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    button[type="reset"] {
      background: #6c757d;
    }

    button[type="reset"]:hover {
      background: #5a6268;
    }

    .success-message {
      padding: 15px;
      background: #d4edda;
      color: #155724;
      border-radius: 4px;
      margin-bottom: 15px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    .data-table td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
    }

    .data-table td:first-child {
      width: 30%;
      background: #f5f5f5;
    }

    .info-box {
      background: white;
      padding: 15px;
      border-radius: 4px;
      border: 1px solid #ddd;
    }

    .info-box p {
      margin: 10px 0;
    }

    .success {
      color: #28a745;
      font-weight: bold;
    }

    .error {
      color: #dc3545;
      font-weight: bold;
    }

    pre {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 12px;
    }
  `]
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
