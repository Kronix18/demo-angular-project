import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Observable, map } from 'rxjs';

export interface DataItem {
  id: number;
  title: string;
  value: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private dataSubject = new BehaviorSubject<DataItem[]>([
    { id: 1, title: 'Item 1', value: 100, timestamp: new Date() },
    { id: 2, title: 'Item 2', value: 200, timestamp: new Date() },
    { id: 3, title: 'Item 3', value: 300, timestamp: new Date() }
  ]);

  data$ = this.dataSubject.asObservable();

  // Real-time data stream (simulated)
  realtimeData$: Observable<number> = interval(2000).pipe(
    map(() => Math.floor(Math.random() * 1000))
  );

  getData(): Observable<DataItem[]> {
    return this.data$;
  }

  addData(item: Omit<DataItem, 'id' | 'timestamp'>): void {
    const items = this.dataSubject.value;
    const newItem: DataItem = {
      ...item,
      id: Math.max(...items.map(i => i.id), 0) + 1,
      timestamp: new Date()
    };
    this.dataSubject.next([...items, newItem]);
  }

  updateData(id: number, updates: Partial<DataItem>): void {
    const items = this.dataSubject.value;
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      this.dataSubject.next([...items]);
    }
  }

  deleteData(id: number): void {
    const items = this.dataSubject.value;
    this.dataSubject.next(items.filter(i => i.id !== id));
  }
}
