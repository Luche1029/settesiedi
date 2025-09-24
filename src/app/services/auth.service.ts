import { Injectable, signal } from '@angular/core';
import { supabase } from '../../../supabase/supabase.client';

export type UserProfile = {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean | null;
  password_hash?: string | null; // solo per capire se è first login
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<UserProfile | null>(null);

  constructor() {
    this.restore();
  }

  /** Carica tutti i profili (per la schermata login-grid) */
  async listProfiles(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('app_user')
      .select('id, display_name, email, avatar_url, is_admin, password_hash')
      .order('display_name');
    if (error) throw error;
    return data as UserProfile[];
  }

  /** Genera token per impostare password (prima volta) */
  async sendPasswordSetup(userId: string): Promise<{ link: string }> {
    const { data, error } = await supabase.rpc('create_password_token', {
      p_user_id: userId,
    });
    if (error) throw error;

    // compatibilità PostgREST (può ritornare row o array)
    const token = (data as any)?.token || data?.[0]?.token;
    if (!token) throw new Error('Impossibile generare token');

    const site = window.location.origin;
    return { link: `${site}/auth/set-password?token=${token}` };
  }

  /** Imposta nuova password con token */
  async setPasswordByToken(token: string, newPassword: string) {
    const { error } = await supabase.rpc('set_password_with_token', {
      p_token: token,
      p_new_password: newPassword,
    });
    if (error) throw error;
    return true;
  }

  /** Login con password */
  async loginWithPassword(userId: string, password: string) {
    // 1) verifica password
    const { data: ok, error } = await supabase.rpc('verify_password', {
      p_user_id: userId,
      p_password: password,
    });
    if (error) throw error;
    if (!ok) throw new Error('Password errata');

    // 2) recupera profilo (senza password_hash)
    const { data: profile, error: e2 } = await supabase
      .from('app_user')
      .select('id, display_name, email, avatar_url, is_admin')
      .eq('id', userId)
      .single();
    if (e2 || !profile) throw e2 || new Error('Profilo non trovato');

    localStorage.setItem('user', JSON.stringify(profile));
    this.user.set(profile as UserProfile);
    return profile;
  }

  /** Logout */
  logout() {
    localStorage.removeItem('user');
    this.user.set(null);
  }

  /** Ripristina utente da localStorage */
  restore() {
    const saved = localStorage.getItem('user');
    if (saved) this.user.set(JSON.parse(saved));
  }

  /** Stato login */
  isLoggedIn() {
    return !!this.user();
  }

  async setPasswordAndPaypalEmailByToken(token: string, password: string, paypalEmail: string) {
    const { error } = await supabase.rpc('set_password_with_paypal_email', {
      p_token: token,
      p_password: password,
      p_paypal_email: paypalEmail
    });
    if (error) throw error;
    return true;
  }
}
