import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { SubscriptionTier } from '../subscriptions/subscription.types';

export interface UserProfile {
  user_id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  email_status: string;
  created_at?: string;
  last_login?: string;
}

export interface UpdateUserProfile {
  name?: string;
  email?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  constructor(private api: ApiService) {}

  /**
   * Get current user's profile from backend
   */
  getProfile(): Observable<UserProfile> {
    console.log('UserService: Fetching user profile from backend');
    return this.api.get<UserProfile>('api/user/profile');
  }

  /**
   * Update user profile
   */
  updateProfile(data: UpdateUserProfile): Observable<UserProfile> {
    return this.api.put<UserProfile>('api/user/profile', data);
  }

  /**
   * Delete user account
   */
  deleteAccount(): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>('api/user/account');
  }
}
