import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ActivityService } from './core/services/activity.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('client');
  private router = inject(Router);
  private activityService = inject(ActivityService);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.logRoute(event.urlAfterRedirects);
    });
  }

  private logRoute(url: string) {
    // Simple mapping logic
    let featureKey = null;

    if (url.includes('/prd-generator')) featureKey = 'prd_generator';
    else if (url.includes('/story-to-code')) featureKey = 'story_to_code';
    else if (url.includes('/cx/research-planner')) featureKey = 'cx_research';
    else if (url.includes('/cx/journey-mapper')) featureKey = 'journey_mapper';
    else if (url.includes('/cx/gap-analyzer')) featureKey = 'experience_gap';
    else if (url.includes('/ideation')) featureKey = 'ideation';
    else if (url.includes('/feasibility')) featureKey = 'feasibility';
    else if (url.includes('/release-prep')) featureKey = 'release_prep';
    else if (url.includes('/roadmap-planner')) featureKey = 'roadmap_planner';
    else if (url.includes('/dashboard')) featureKey = 'dashboard';

    if (featureKey) {
      this.activityService.logActivity(featureKey);
    }
  }
}
