import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private usersSubject = new BehaviorSubject<User[]>([
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'admin' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'user' }
  ]);

  private currentUserSubject = new BehaviorSubject<User | null>(null);

  users$ = this.usersSubject.asObservable();
  currentUser$ = this.currentUserSubject.asObservable();

  getUsers(): Observable<User[]> {
    return this.users$;
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser$;
  }

  setCurrentUser(user: User | null): void {
    this.currentUserSubject.next(user);
  }

  updateUser(id: string, updates: Partial<User>): void {
    const users = this.usersSubject.value;
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      this.usersSubject.next([...users]);
    }
  }

  addUser(user: User): void {
    const users = this.usersSubject.value;
    this.usersSubject.next([...users, user]);
  }

  deleteUser(id: string): void {
    const users = this.usersSubject.value;
    this.usersSubject.next(users.filter(u => u.id !== id));
  }
}
