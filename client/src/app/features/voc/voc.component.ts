import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-voc',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-50 p-8">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl font-bold mb-8">Voice of Customer</h1>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <a href="/voc-run-analysis.html" class="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
            <h2 class="text-xl font-semibold mb-2">Run Analysis</h2>
            <p class="text-gray-600">Analyze customer feedback from multiple sources</p>
          </a>

          <a href="/voc-schedule.html" class="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
            <h2 class="text-xl font-semibold mb-2">Schedule Analysis</h2>
            <p class="text-gray-600">Set up recurring analysis runs</p>
          </a>

          <a href="/voc-saved-insights.html" class="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
            <h2 class="text-xl font-semibold mb-2">Saved Insights</h2>
            <p class="text-gray-600">Browse historical insights and themes</p>
          </a>

          <a href="/voc-manage-sources.html" class="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
            <h2 class="text-xl font-semibold mb-2">Manage Sources</h2>
            <p class="text-gray-600">Connect and configure data sources</p>
          </a>

          <a href="/voc-log-feedback.html" class="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
            <h2 class="text-xl font-semibold mb-2">Log Feedback</h2>
            <p class="text-gray-600">Manually add customer feedback</p>
          </a>

          <a href="/discovery-hub.html" class="block p-6 bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
            <h2 class="text-xl font-semibold mb-2">Discovery Hub</h2>
            <p class="text-gray-600">View all VOC analysis sessions</p>
          </a>
        </div>
      </div>
    </div>
  `,
})
export class VocComponent {}
