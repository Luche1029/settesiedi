import { Injectable, signal } from '@angular/core';
import { supabase } from '../supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<any | null>(null);

  async login(name: string) {
    const { data, error } = await supabase
      .from('app_user')
      .select('*')
      .eq('display_name', name)
      .single();

    if (error || !data) throw new Error('Nome non autorizzato');

    localStorage.setItem('user', JSON.stringify(data));
    this.user.set(data);
    return data;
  }

  logout() {
    localStorage.removeItem('user');
    this.user.set(null);
  }

  restore() {
    const saved = localStorage.getItem('user');
    if (saved) this.user.set(JSON.parse(saved));
  }

  isLoggedIn() {
    return !!this.user();
  }
}
