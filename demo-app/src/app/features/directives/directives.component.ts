import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Item {
  id: number;
  name: string;
  status: 'active' | 'inactive' | 'pending';
  price: number;
}

@Component({
  selector: 'app-directives',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './directives.component.html',
  styleUrl: './directives.component.scss'
})
export class DirectivesComponent {
  showContent = false;
  isLoggedIn = true;
  selectedStatus = 'active';
  highlightedItem = 0;
  inputValue = '';
  filterStatus = '';

  items: Item[] = [
    { id: 1, name: 'Product A', status: 'active', price: 99.99 },
    { id: 2, name: 'Product B', status: 'inactive', price: 49.99 },
    { id: 3, name: 'Product C', status: 'pending', price: 79.99 },
    { id: 4, name: 'Product D', status: 'active', price: 129.99 },
    { id: 5, name: 'Product E', status: 'pending', price: 59.99 }
  ];

  get filteredItems(): Item[] {
    return this.filterStatus
      ? this.items.filter(item => item.status === this.filterStatus)
      : this.items;
  }
}
