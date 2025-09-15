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
  participantsNames?: string[];
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
    const [goingMap, totalMap, namesMap] = await Promise.all([
      this.countGoingForEvents(ids),
      this.sumExpensesForEvents(ids),
      this.getGoingNamesForEvents(ids),
    ]);
    return rows.map(r => ({
      ...r,
      participants: goingMap[r.id] || 0,
      total: Number((totalMap[r.id] || 0).toFixed(2)),
      participantsNames: namesMap[r.id] || []
    }) as any);
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

  async listAdmin(startISO?: string, endISO?: string, includeArchived = false) {
    let q = supabase
      .from('event')
      .select('id, event_date, title, notes, archived, created_at, source_proposal_id, app_user:created_by(display_name)')
      .order('event_date', { ascending: true });

    if (startISO) q = q.gte('event_date', startISO);
    if (endISO)   q = q.lte('event_date', endISO);
    if (!includeArchived) q = q.eq('archived', false);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((e: any) => ({
      ...e,
      creator_name: e.app_user?.display_name ?? '—'
    }));
  }

  async updateDate(eventId: string, newDate: string) {
    const { error } = await supabase
      .from('event')
      .update({ event_date: newDate })
      .eq('id', eventId);
    if (error) throw error;
    return true;
  }

  async setArchived(eventId: string, archived: boolean) {
    const { error } = await supabase
      .from('event')
      .update({ archived })
      .eq('id', eventId);
    if (error) throw error;
    return true;
  }

  async remove(eventId: string) {
    const { error } = await supabase.from('event').delete().eq('id', eventId);
    if (error) throw error;
    return true;
  }

  async revertApproval(eventId: string, force = false) {
    const { error } = await supabase.rpc('revert_approval', {
      p_event: eventId,
      p_force: force
    });
    if (error) throw error;
    return true;
  }

  /** Mappa {event_id -> array di nomi (display_name)} dei partecipanti 'going' */
  async getGoingNamesForEvents(eventIds: string[]): Promise<Record<string, string[]>> {
    if (!eventIds.length) return {};
    const { data, error } = await supabase
      .from('reservation')
      .select('event_id, user_id:app_user(display_name), status')
      .in('event_id', eventIds)
      .eq('status', 'going');

    if (error) throw error;

    const map: Record<string, string[]> = {};
    for (const r of (data as any[]) || []) {
      const name = r.user_id?.display_name ?? '—';
      (map[r.event_id] ??= []).push(name);
    }

    // ordina alfabeticamente per estetica
    Object.keys(map).forEach(k => map[k].sort((a,b)=>a.localeCompare(b)));
    return map;
  }

  

}
