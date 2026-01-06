import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiSettingsService, AiModelConfig } from './ai-settings.service';

@Component({
    selector: 'app-ai-model-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="px-4 sm:px-6 lg:px-8 py-8">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-bold text-gray-900 mb-6">AI Model Settings</h1>
        
        <div class="bg-white shadow rounded-lg overflow-hidden">
          <div class="p-6 space-y-6">
            
            <div>
               <h3 class="text-lg font-medium text-gray-900">Global AI Model</h3>
               <p class="text-sm text-gray-500">Select the default AI model to be used across the application for text generation and reasoning. Note: Embeddings use a fixed model.</p>
            </div>

            <div class="border-t border-gray-200"></div>

            <!-- Form -->
            <form (ngSubmit)="saveSettings()">
               <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  
                  <div class="sm:col-span-4">
                     <label for="model" class="block text-sm font-medium text-gray-700">Active Model</label>
                     <div class="mt-1">
                        <select 
                           id="model" 
                           name="model" 
                           [(ngModel)]="selectedModel"
                           class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        >
                           <option *ngFor="let option of modelOptions" [value]="option.value">{{ option.label }}</option>
                        </select>
                     </div>
                     <p class="mt-2 text-sm text-gray-500">
                        Changes apply immediately to new tasks.
                     </p>
                  </div>

               </div>

               <div class="mt-6 flex items-center justify-end">
                  <div *ngIf="successMessage()" class="mr-4 text-sm text-green-600 font-medium fade-in">
                     {{ successMessage() }}
                  </div>
                   <div *ngIf="errorMessage()" class="mr-4 text-sm text-red-600 font-medium fade-in">
                     {{ errorMessage() }}
                  </div>
                  <button 
                     type="submit" 
                     [disabled]="saving()"
                     class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                     {{ saving() ? 'Saving...' : 'Save Settings' }}
                  </button>
               </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  `
})
export class AiModelSettingsComponent implements OnInit {
    aiSettingsService = inject(AiSettingsService);

    selectedModel = '';
    saving = signal(false);
    successMessage = signal('');
    errorMessage = signal('');

    modelOptions = [
        { value: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
        { value: 'openai/gpt-oss-120b', label: 'GPT-OSS-120b' },
        { value: 'openai/gpt-5', label: 'GPT-5' },
        { value: 'openai/gpt-5.2', label: 'GPT-5.2' },
        { value: 'x-ai/grok-4', label: 'Grok 4' },
        { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' }
    ];

    ngOnInit() {
        this.loadSettings();
    }

    loadSettings() {
        this.aiSettingsService.getActiveModel().subscribe({
            next: (config) => {
                this.selectedModel = config.model;
            },
            error: (err) => {
                console.error('Failed to load AI settings', err);
                this.errorMessage.set('Failed to load current settings.');
            }
        });
    }

    saveSettings() {
        this.saving.set(true);
        this.successMessage.set('');
        this.errorMessage.set('');

        this.aiSettingsService.updateActiveModel(this.selectedModel).subscribe({
            next: () => {
                this.saving.set(false);
                this.successMessage.set('Settings saved successfully.');
                setTimeout(() => this.successMessage.set(''), 3000);
            },
            error: (err) => {
                console.error('Failed to save settings', err);
                this.saving.set(false);
                this.errorMessage.set('Failed to save settings.');
            }
        });
    }
}
