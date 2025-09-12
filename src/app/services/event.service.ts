// src/app/services/event.service.ts
import { Injectable } from '@angular/core';
import { supabase } from '../supabase.client';

export interface EventRow {
  id: string;
  event_date: string;        // YYYY-MM-DD
  title?: string | null;
  notes?: string | null;
}

export interface EventCardVM extends EventRow {
  participants: number;      // going
  total: number;             // somma spese €
}

@Injectable({ providedIn: 'root' })
export class EventService {

  async listByWeek(startISO: string, endISO: string): Promise<EventRow[]> {
    const { data, error } = await supabase
      .from('event')
      .select('id, event_date, title, notes')
      .gte('event_date', startISO)
      .lte('event_date', endISO)
      .order('event_date', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /** Ritorna mappa {event_id -> count going} */
  async countGoingForEvents(eventIds: string[]): Promise<Record<string, number>> {
    if (eventIds.length === 0) return {};
    const { data, error } = await supabase
      .from('reservation')
      .select('event_id, status')
      .in('event_id', eventIds);
    if (error) throw error;
    const acc: Record<string, number> = {};
    for (const r of data || []) {
      if (r.status === 'going') acc[r.event_id] = (acc[r.event_id] || 0) + 1;
    }
    return acc;
  }

  /** Ritorna mappa {event_id -> somma spese} */
  async sumExpensesForEvents(eventIds: string[]): Promise<Record<string, number>> {
    if (eventIds.length === 0) return {};
    const { data, error } = await supabase
      .from('expense')
      .select('event_id, amount')
      .in('event_id', eventIds);
    if (error) throw error;
    const acc: Record<string, number> = {};
    for (const e of data || []) {
      acc[e.event_id] = (acc[e.event_id] || 0) + Number(e.amount || 0);
    }
    return acc;
  }

  /** Comodo: eventi + stats in un colpo solo (client-side) */
  async listByWeekWithStats(startISO: string, endISO: string): Promise<EventCardVM[]> {
    const rows = await this.listByWeek(startISO, endISO);
    const ids = rows.map(r => r.id);
    const [goingMap, totalMap] = await Promise.all([
      this.countGoingForEvents(ids),
      this.sumExpensesForEvents(ids),
    ]);
    return rows.map(r => ({
      ...r,
      participants: goingMap[r.id] || 0,
      total: Number((totalMap[r.id] || 0).toFixed(2)),
    }));
  }

  // + aggiungi:
    async getWithItems(id: string) {
    const { data, error } = await supabase
        .from('event')
        .select('id, event_date, title, notes, event_item(id,name,notes)')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
    }

}
