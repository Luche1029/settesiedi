import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-event-items',
  standalone: true,
  imports: [CommonModule],
  templateUrl:'./event-items.html'
})
export class EventItems {
  @Input() eventId!: string;
  @Input() items: any[] = [];
}
