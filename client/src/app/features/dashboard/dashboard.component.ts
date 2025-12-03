import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="p-6 lg:p-8">
      <h1 class="text-2xl font-bold text-foreground">Dashboard</h1>
      <p class="mt-2 text-muted-foreground">
        Welcome to your dashboard. This is a sample authenticated view.
      </p>

      <div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        @for (stat of stats; track stat.label) {
          <div class="rounded-lg border bg-card p-6 shadow-sm">
            <p class="text-sm font-medium text-muted-foreground">{{ stat.label }}</p>
            <p class="mt-2 text-3xl font-bold text-card-foreground">{{ stat.value }}</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class DashboardComponent {
  stats = [
    { label: 'Total Users', value: '1,234' },
    { label: 'Active Projects', value: '56' },
    { label: 'Tasks Completed', value: '892' },
    { label: 'Revenue', value: '$12.4k' },
  ];
}
