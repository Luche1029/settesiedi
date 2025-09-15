import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserProfile } from '../../../services/auth.service';

@Component({
  selector: 'app-login-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-grid.html'
})
export class LoginGrid implements OnInit {

  private auth = inject(AuthService);
  private router = inject(Router);

  profiles = signal<UserProfile[]>([]);
  selected = signal<UserProfile | null>(null);
  password = signal('');
  msg = signal('');
  link = '';
  loading = signal(false);

  firstTime = computed(() => !this.selected()?.password_hash);

  async ngOnInit() {
    // se già loggato → vai a /menus
    this.auth.restore();
    if (this.auth.isLoggedIn()) { this.router.navigateByUrl('/menus'); return; }

    try {
      this.loading.set(true);
      const rows = await this.auth.listProfiles();
      this.profiles.set(rows);
    } catch (e:any) {
      this.msg.set(e.message ?? 'Errore caricamento profili');
    } finally {
      this.loading.set(false);
    }
  }

  pick(p: UserProfile) { this.selected.set(p); this.password.set(''); this.msg.set(''); }
  back() { this.selected.set(null); this.password.set(''); this.msg.set(''); }

  async sendSetup() {
    const p = this.selected(); if (!p) return;
    this.loading.set(true); this.msg.set('');
    try {
      const { link } = await this.auth.sendPasswordSetup(p.id);
      // In prod invierai una mail; per ora mostriamo il link
      this.msg.set('Link per impostare la password:');
      this.link = link;
    } catch (e:any) { this.msg.set(e.message ?? 'Errore invio'); }
    finally { this.loading.set(false); }
  }

  async login() {
    const p = this.selected(); if (!p) return;
    this.loading.set(true); this.msg.set('');
    try {
      await this.auth.loginWithPassword(p.id, this.password());
      this.router.navigateByUrl('/menus');
    } catch (e:any) { this.msg.set(e.message ?? 'Errore login'); }
    finally { this.loading.set(false); }
  }

  encodeName(name: string) {
    return encodeURIComponent(name);
  }

}
