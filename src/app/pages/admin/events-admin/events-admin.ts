// src/app/pages/admin/events-admin/events-admin.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { EventService } from '../../../services/event.service';

function todayISO() { return new Date().toISOString().slice(0,10); }
function addDaysISO(iso: string, n: number) {
  const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10);
}

@Component({
  selector: 'app-events-admin',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './events-admin.html',
  styleUrl: './events-admin.scss'
})
export class EventsAdmin implements OnInit {
  private events = inject(EventService);
  private router = inject(Router);

  startISO = signal(addDaysISO(todayISO(), -14));
  endISO   = signal(addDaysISO(todayISO(), 21));
  includeArchived = signal(false);

  rows = signal<any[]>([]);
  loading = signal(false);
  message = signal('');

  // mappe di editing inline
  editDate = new Map<string, string>();      // eventId -> YYYY-MM-DD
  forceRevert = new Map<string, boolean>();  // eventId -> true/false

  async ngOnInit(){ await this.load(); }

  async load() {
    this.loading.set(true); this.message.set('');
    try {
      const data = await this.events.listAdmin(this.startISO(), this.endISO(), this.includeArchived());
      this.rows.set(data);
      this.editDate.clear();
      this.forceRevert.clear();
      data.forEach(e => this.editDate.set(e.id, e.event_date));
    } catch (e:any) {
      this.message.set(e.message ?? 'Errore caricamento eventi');
    } finally { this.loading.set(false); }
  }

  setStart(v: string){ this.startISO.set(v); }
  setEnd(v: string){ this.endISO.set(v); }

  setDate(id: string, v: string){ this.editDate.set(id, v); }
  toggleForce(id: string, checked: boolean){ this.forceRevert.set(id, checked); }

  async saveDate(e: any){
    const id = e.id;
    const d  = this.editDate.get(id) || e.event_date;
    try {
      await this.events.updateDate(id, d);
      this.message.set('Data aggiornata ✅');
      await this.load();
    } catch (err:any) {
      this.message.set(err.message ?? 'Errore aggiornamento data');
    }
  }

  async archive(e: any, archived: boolean){
    try {
      await this.events.setArchived(e.id, archived);
      this.message.set(archived ? 'Evento archiviato' : 'Evento ripristinato');
      await this.load();
    } catch (err:any) {
      this.message.set(err.message ?? 'Errore archiviazione');
    }
  }

  async revert(e: any){
    const force = !!this.forceRevert.get(e.id);
    if (!confirm(`Annullare approvazione per questo evento? ${force ? '(FORZA ON)' : ''}`)) return;
    try {
      await this.events.revertApproval(e.id, force);
      this.message.set('Evento annullato e proposal riportata a submitted');
      await this.load();
    } catch (err:any) {
      this.message.set(err.message ?? 'Errore revert');
    }
  }

  async remove(e: any){
    if (!confirm('Eliminare definitivamente questo evento?')) return;
    try {
      await this.events.remove(e.id);
      this.message.set('Evento eliminato');
      await this.load();
    } catch (err:any) {
      this.message.set(err.message ?? 'Errore eliminazione');
    }
  }

  open(e: any){ this.router.navigate(['/menus', e.id]); }
}
