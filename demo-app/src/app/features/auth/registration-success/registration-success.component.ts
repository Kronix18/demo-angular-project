import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-registration-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './registration-success.component.html',
  styleUrl: './registration-success.component.scss'
})
export class RegistrationSuccessComponent implements OnInit {
  maskedEmail = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const email = this.route.snapshot.queryParams['email'];
    if (!email) {
      // Redirect to login if no email provided
      this.router.navigate(['/auth/login']);
      return;
    }
    this.maskedEmail = this.maskEmail(email);
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;

    // Show first character and mask the rest of local part
    const maskedLocal = localPart.length > 1 
      ? localPart[0] + '*'.repeat(Math.min(localPart.length - 1, 3))
      : localPart;

    // Mask domain name but show TLD
    const [domainName, ...tldParts] = domain.split('.');
    const maskedDomain = domainName.length > 1
      ? domainName[0] + '*'.repeat(Math.min(domainName.length - 1, 3))
      : domainName;

    return `${maskedLocal}@${maskedDomain}.${tldParts.join('.')}`;
  }
}
