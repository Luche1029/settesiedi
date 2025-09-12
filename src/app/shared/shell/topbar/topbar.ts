import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './topbar.html'
})
export class Topbar {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = computed(() => this.auth.user());

  async logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
