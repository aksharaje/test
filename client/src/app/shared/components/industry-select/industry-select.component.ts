import {
  Component,
  input,
  output,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideSearch,
  lucideCheck,
} from '@ng-icons/lucide';

export interface IndustryOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-industry-select',
  standalone: true,
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideSearch,
      lucideCheck,
    }),
  ],
  template: `
    <div class="relative">
      <button
        type="button"
        class="w-full flex items-center justify-between rounded-lg border bg-background p-3 text-sm text-left"
        [class.text-muted-foreground]="!value()"
        (click)="toggleDropdown()"
      >
        <span>{{ selectedLabel() || placeholder() }}</span>
        <ng-icon [name]="dropdownOpen() ? 'lucideChevronDown' : 'lucideChevronRight'" class="h-4 w-4" />
      </button>

      @if (dropdownOpen()) {
        <div class="absolute z-20 mt-1 w-full rounded-lg border bg-background shadow-lg">
          <div class="p-2 border-b">
            <div class="relative">
              <ng-icon name="lucideSearch" class="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                class="w-full rounded border bg-muted/30 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Type to filter..."
                [value]="filter()"
                (input)="onFilterInput($event)"
              />
            </div>
          </div>
          <div class="max-h-64 overflow-y-auto p-1">
            @for (industry of filteredIndustries(); track industry.value) {
              <button
                type="button"
                class="w-full flex items-center gap-2 rounded p-2 text-sm hover:bg-muted/50 text-left"
                [class.bg-primary/10]="value() === industry.value"
                (click)="selectIndustry(industry.value)"
              >
                @if (value() === industry.value) {
                  <ng-icon name="lucideCheck" class="h-4 w-4 text-primary" />
                } @else {
                  <div class="h-4 w-4"></div>
                }
                <span>{{ industry.label }}</span>
              </button>
            }
            @if (filteredIndustries().length === 0) {
              <p class="p-2 text-sm text-muted-foreground text-center">No matching industries</p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class IndustrySelectComponent {
  // Inputs
  industries = input.required<IndustryOption[]>();
  value = input<string>('');
  placeholder = input<string>('Select an industry...');

  // Outputs
  valueChange = output<string>();

  // Internal state
  dropdownOpen = signal(false);
  filter = signal('');

  selectedLabel = computed(() => {
    const val = this.value();
    if (!val) return '';
    const industry = this.industries().find((i) => i.value === val);
    return industry?.label || val;
  });

  filteredIndustries = computed(() => {
    const filterText = this.filter().toLowerCase();
    const industries = this.industries();
    if (!filterText) return industries;
    return industries.filter((i) => i.label.toLowerCase().includes(filterText));
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.dropdownOpen.set(false);
    }
  }

  toggleDropdown(): void {
    this.dropdownOpen.update((v) => !v);
    if (this.dropdownOpen()) {
      this.filter.set('');
    }
  }

  onFilterInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filter.set(input.value);
  }

  selectIndustry(value: string): void {
    this.valueChange.emit(value);
    this.dropdownOpen.set(false);
  }
}
