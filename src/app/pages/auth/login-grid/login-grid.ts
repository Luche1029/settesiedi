// src/app/pages/auth/login-grid/login-grid.ts
import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { supabase } from '../../../../../supabase/supabase.client';

type ProfileVM = UserProfile & { avatarUrl?: string | null };

@Component({
  selector: 'app-login-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-grid.html',
  styleUrl: './login-grid.scss'
})
export class LoginGrid implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  profiles = signal<ProfileVM[]>([]);
  selected = signal<ProfileVM | null>(null);
  password = signal('');
  msg = signal('');
  link = signal('');             // <— era string, ora signal per coerenza
  loading = signal(false);

  firstTime = computed(() => !this.selected()?.password_hash);

  async ngOnInit() {
    // già loggato? vai ai menu
    this.auth.restore();
    if (this.auth.isLoggedIn()) { this.router.navigateByUrl('/menus'); return; }

    try {
      this.loading.set(true);
      const rows = await this.auth.listProfiles(); // deve restituire: id, display_name, email, password_hash, avatar?
      // firma avatar se è un path nel bucket
      const withAvatars = await Promise.all(
        (rows || []).map(async (u: UserProfile) => {
          let avatarUrl: string | null = null;
          if (u.avatar) {
            const { data, error } = await supabase.storage.from('avatars').createSignedUrl(u.avatar, 600);
            if (!error) avatarUrl = data?.signedUrl ?? null;
          }
          return { ...u, avatarUrl } as ProfileVM;
        })
      );
      this.profiles.set(withAvatars);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento profili');
    } finally {
      this.loading.set(false);
    }
  }

  pick(p: ProfileVM) {
    this.selected.set(p);
    this.password.set('');
    this.msg.set('');
    this.link.set('');
  }
  back() {
    this.selected.set(null);
    this.password.set('');
    this.msg.set('');
    this.link.set('');
  }

  async sendSetup() {
    const p = this.selected(); if (!p) return;
    this.loading.set(true); this.msg.set(''); this.link.set('');
    try {
      const { link } = await this.auth.sendPasswordSetup(p.id);
      // MVP: mostriamo il link; in prod lo invii via mail
      this.msg.set('Link per impostare la password:');
      this.link.set(link);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore invio link');
    } finally {
      this.loading.set(false);
    }
  }

  async login() {
    const p = this.selected(); if (!p) return;
    this.loading.set(true); this.msg.set('');
    try {
      await this.auth.loginWithPassword(p.id, this.password());
      this.router.navigateByUrl('/menus');
    } catch (e:any) {
      this.msg.set(e.message ?? 'Credenziali non valide');
    } finally {
      this.loading.set(false);
    }
  }

  encodeName(name: string) { return encodeURIComponent(name); }
}
