import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClipboardList, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideClock, lucideAlertTriangle, lucideShield, lucidePackage, lucideChevronRight, lucideActivity, lucidePencil, lucideTrash2, lucideGripVertical, lucideX, lucideCheck, lucidePlus, lucideFileText } from '@ng-icons/lucide';
import { CdkDragDrop, CdkDrag, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ScopeDefinitionService } from './scope-definition.service';
import type { ScopeDefinitionSession, ScopeItem, ScopeAssumption, ScopeConstraint, ScopeDeliverable } from './scope-definition.types';
import { HlmButtonDirective } from '../../ui/button';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-scope-definition-results',
  standalone: true,
  imports: [NgIcon, HlmButtonDirective, CdkDropList, CdkDrag, FormsModule],
  viewProviders: [provideIcons({ lucideClipboardList, lucideLoader2, lucideArrowLeft, lucideRotateCw, lucideAlertCircle, lucideCheckCircle, lucideXCircle, lucideClock, lucideAlertTriangle, lucideShield, lucidePackage, lucideChevronRight, lucideActivity, lucidePencil, lucideTrash2, lucideGripVertical, lucideX, lucideCheck, lucidePlus, lucideFileText })],
  template: `
    <div class="h-full overflow-y-auto">
      <div class="max-w-5xl mx-auto p-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <button hlmBtn variant="ghost" size="icon" (click)="goBack()"><ng-icon name="lucideArrowLeft" class="h-5 w-5" /></button>
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ng-icon name="lucideClipboardList" class="h-5 w-5 text-primary" /></div>
              <div>
                <h1 class="text-2xl font-bold">{{ session()?.projectName || 'Scope Definition' }}</h1>
                <p class="text-sm text-muted-foreground">Scope Definition Results</p>
              </div>
            </div>
          </div>
          <button hlmBtn variant="outline" (click)="exportToPdf()"><ng-icon name="lucideFileText" class="mr-2 h-4 w-4" /> Export PDF</button>
        </div>

        @if (isLoading()) {
          <div class="flex flex-col items-center justify-center py-16">
            <ng-icon name="lucideLoader2" class="h-12 w-12 text-primary animate-spin" />
            <p class="mt-4 text-lg font-medium text-muted-foreground">{{ session()?.progressMessage || 'Defining scope...' }}</p>
          </div>
        }

        @if (session()?.status === 'failed') {
          <div class="rounded-lg border border-destructive bg-destructive/10 p-6">
            <div class="flex items-start gap-4">
              <ng-icon name="lucideAlertCircle" class="h-6 w-6 text-destructive" />
              <div>
                <h3 class="font-semibold text-destructive">Generation Failed</h3>
                <p class="mt-1 text-sm">{{ session()?.errorMessage }}</p>
                <button hlmBtn variant="outline" size="sm" class="mt-4" (click)="retry()"><ng-icon name="lucideRotateCw" class="mr-2 h-4 w-4" /> Retry</button>
              </div>
            </div>
          </div>
        }

        @if (session()?.status === 'completed') {
          @if (session()?.scopeStatement) {
            <div class="rounded-lg border bg-primary/5 p-4 mb-6">
              <h2 class="font-semibold mb-2">Scope Statement</h2>
              <p class="text-sm text-muted-foreground">{{ session()?.scopeStatement }}</p>
            </div>
          }

          <p class="text-xs text-muted-foreground mb-4">Drag and drop items between categories to reorganize scope</p>

          <!-- Scope Items Grid -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <!-- In Scope -->
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold flex items-center gap-2"><ng-icon name="lucideCheckCircle" class="h-4 w-4 text-green-600" /> In Scope ({{ inScopeItems().length }})</h2>
                <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0" (click)="startAddItem('in_scope')"><ng-icon name="lucidePlus" class="h-3 w-3" /></button>
              </div>
              @if (addingItemType() === 'in_scope') {
                <div class="rounded border p-3 bg-muted/30 mb-2">
                  <input type="text" class="w-full text-sm font-medium border rounded px-2 py-1 mb-1" [(ngModel)]="newItem.title" placeholder="Title" />
                  <textarea class="w-full text-xs border rounded px-2 py-1" [(ngModel)]="newItem.description" placeholder="Description" rows="2"></textarea>
                  <div class="flex gap-1 mt-2">
                    <button hlmBtn size="sm" variant="default" (click)="saveNewItem('in_scope')"><ng-icon name="lucideCheck" class="h-3 w-3 mr-1" /> Add</button>
                    <button hlmBtn size="sm" variant="ghost" (click)="cancelAdd()"><ng-icon name="lucideX" class="h-3 w-3" /></button>
                  </div>
                </div>
              }
              <div cdkDropList #inScopeList="cdkDropList" [cdkDropListData]="inScopeItems()" [cdkDropListConnectedTo]="[outOfScopeList, deferredList]" (cdkDropListDropped)="onDrop($event, 'in_scope')" class="space-y-2 min-h-[100px]">
                @for (item of inScopeItems(); track item.id) {
                  <div cdkDrag class="rounded border p-3 bg-background border-l-4 border-l-green-500 group cursor-move">
                    <div cdkDragHandle class="flex items-start gap-2">
                      <ng-icon name="lucideGripVertical" class="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                      <div class="flex-1 min-w-0">
                        @if (editingItemId() === item.id) {
                          <input type="text" class="w-full text-sm font-medium border rounded px-2 py-1 mb-1" [(ngModel)]="editingItem.title" />
                          <textarea class="w-full text-xs border rounded px-2 py-1" [(ngModel)]="editingItem.description" rows="2"></textarea>
                          <div class="flex gap-1 mt-2">
                            <button hlmBtn size="sm" variant="ghost" (click)="saveItem(item)"><ng-icon name="lucideCheck" class="h-3 w-3" /></button>
                            <button hlmBtn size="sm" variant="ghost" (click)="cancelEdit()"><ng-icon name="lucideX" class="h-3 w-3" /></button>
                          </div>
                        } @else {
                          <h3 class="font-medium text-sm">{{ item.title }}</h3>
                          <p class="text-xs text-muted-foreground line-clamp-2">{{ item.description }}</p>
                          <div class="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0" (click)="startEdit(item)"><ng-icon name="lucidePencil" class="h-3 w-3" /></button>
                            <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0 text-destructive" (click)="deleteItem(item)"><ng-icon name="lucideTrash2" class="h-3 w-3" /></button>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Out of Scope -->
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold flex items-center gap-2"><ng-icon name="lucideXCircle" class="h-4 w-4 text-red-600" /> Out of Scope ({{ outOfScopeItems().length }})</h2>
                <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0" (click)="startAddItem('out_of_scope')"><ng-icon name="lucidePlus" class="h-3 w-3" /></button>
              </div>
              @if (addingItemType() === 'out_of_scope') {
                <div class="rounded border p-3 bg-muted/30 mb-2">
                  <input type="text" class="w-full text-sm font-medium border rounded px-2 py-1 mb-1" [(ngModel)]="newItem.title" placeholder="Title" />
                  <textarea class="w-full text-xs border rounded px-2 py-1" [(ngModel)]="newItem.description" placeholder="Description" rows="2"></textarea>
                  <div class="flex gap-1 mt-2">
                    <button hlmBtn size="sm" variant="default" (click)="saveNewItem('out_of_scope')"><ng-icon name="lucideCheck" class="h-3 w-3 mr-1" /> Add</button>
                    <button hlmBtn size="sm" variant="ghost" (click)="cancelAdd()"><ng-icon name="lucideX" class="h-3 w-3" /></button>
                  </div>
                </div>
              }
              <div cdkDropList #outOfScopeList="cdkDropList" [cdkDropListData]="outOfScopeItems()" [cdkDropListConnectedTo]="[inScopeList, deferredList]" (cdkDropListDropped)="onDrop($event, 'out_of_scope')" class="space-y-2 min-h-[100px]">
                @for (item of outOfScopeItems(); track item.id) {
                  <div cdkDrag class="rounded border p-3 bg-background border-l-4 border-l-red-500 group cursor-move">
                    <div cdkDragHandle class="flex items-start gap-2">
                      <ng-icon name="lucideGripVertical" class="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                      <div class="flex-1 min-w-0">
                        @if (editingItemId() === item.id) {
                          <input type="text" class="w-full text-sm font-medium border rounded px-2 py-1 mb-1" [(ngModel)]="editingItem.title" />
                          <textarea class="w-full text-xs border rounded px-2 py-1" [(ngModel)]="editingItem.description" rows="2"></textarea>
                          <div class="flex gap-1 mt-2">
                            <button hlmBtn size="sm" variant="ghost" (click)="saveItem(item)"><ng-icon name="lucideCheck" class="h-3 w-3" /></button>
                            <button hlmBtn size="sm" variant="ghost" (click)="cancelEdit()"><ng-icon name="lucideX" class="h-3 w-3" /></button>
                          </div>
                        } @else {
                          <h3 class="font-medium text-sm">{{ item.title }}</h3>
                          <p class="text-xs text-muted-foreground line-clamp-2">{{ item.description }}</p>
                          <div class="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0" (click)="startEdit(item)"><ng-icon name="lucidePencil" class="h-3 w-3" /></button>
                            <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0 text-destructive" (click)="deleteItem(item)"><ng-icon name="lucideTrash2" class="h-3 w-3" /></button>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Deferred -->
            <div class="border rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold flex items-center gap-2"><ng-icon name="lucideClock" class="h-4 w-4 text-amber-600" /> Deferred ({{ deferredItems().length }})</h2>
                <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0" (click)="startAddItem('deferred')"><ng-icon name="lucidePlus" class="h-3 w-3" /></button>
              </div>
              @if (addingItemType() === 'deferred') {
                <div class="rounded border p-3 bg-muted/30 mb-2">
                  <input type="text" class="w-full text-sm font-medium border rounded px-2 py-1 mb-1" [(ngModel)]="newItem.title" placeholder="Title" />
                  <textarea class="w-full text-xs border rounded px-2 py-1" [(ngModel)]="newItem.description" placeholder="Description" rows="2"></textarea>
                  <div class="flex gap-1 mt-2">
                    <button hlmBtn size="sm" variant="default" (click)="saveNewItem('deferred')"><ng-icon name="lucideCheck" class="h-3 w-3 mr-1" /> Add</button>
                    <button hlmBtn size="sm" variant="ghost" (click)="cancelAdd()"><ng-icon name="lucideX" class="h-3 w-3" /></button>
                  </div>
                </div>
              }
              <div cdkDropList #deferredList="cdkDropList" [cdkDropListData]="deferredItems()" [cdkDropListConnectedTo]="[inScopeList, outOfScopeList]" (cdkDropListDropped)="onDrop($event, 'deferred')" class="space-y-2 min-h-[100px]">
                @for (item of deferredItems(); track item.id) {
                  <div cdkDrag class="rounded border p-3 bg-background border-l-4 border-l-amber-500 group cursor-move">
                    <div cdkDragHandle class="flex items-start gap-2">
                      <ng-icon name="lucideGripVertical" class="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                      <div class="flex-1 min-w-0">
                        @if (editingItemId() === item.id) {
                          <input type="text" class="w-full text-sm font-medium border rounded px-2 py-1 mb-1" [(ngModel)]="editingItem.title" />
                          <textarea class="w-full text-xs border rounded px-2 py-1" [(ngModel)]="editingItem.description" rows="2"></textarea>
                          <div class="flex gap-1 mt-2">
                            <button hlmBtn size="sm" variant="ghost" (click)="saveItem(item)"><ng-icon name="lucideCheck" class="h-3 w-3" /></button>
                            <button hlmBtn size="sm" variant="ghost" (click)="cancelEdit()"><ng-icon name="lucideX" class="h-3 w-3" /></button>
                          </div>
                        } @else {
                          <h3 class="font-medium text-sm">{{ item.title }}</h3>
                          <p class="text-xs text-muted-foreground line-clamp-2">{{ item.description }}</p>
                          <div class="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0" (click)="startEdit(item)"><ng-icon name="lucidePencil" class="h-3 w-3" /></button>
                            <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0 text-destructive" (click)="deleteItem(item)"><ng-icon name="lucideTrash2" class="h-3 w-3" /></button>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Assumptions & Constraints -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold flex items-center gap-2"><ng-icon name="lucideAlertTriangle" class="h-5 w-5" /> Assumptions ({{ assumptions().length }})</h2>
                <button hlmBtn size="sm" variant="ghost" (click)="startAddAssumption()"><ng-icon name="lucidePlus" class="h-4 w-4 mr-1" /> Add</button>
              </div>
              @if (addingAssumption()) {
                <div class="rounded border p-3 bg-muted/30 mb-2">
                  <textarea class="w-full text-sm border rounded px-2 py-1 mb-1" [(ngModel)]="newAssumption.assumption" placeholder="Assumption" rows="2"></textarea>
                  <textarea class="w-full text-xs border rounded px-2 py-1" [(ngModel)]="newAssumption.riskIfWrong" placeholder="Risk if wrong" rows="2"></textarea>
                  <div class="flex gap-1 mt-2">
                    <button hlmBtn size="sm" variant="default" (click)="saveNewAssumption()"><ng-icon name="lucideCheck" class="h-3 w-3 mr-1" /> Add</button>
                    <button hlmBtn size="sm" variant="ghost" (click)="cancelAddAssumption()"><ng-icon name="lucideX" class="h-3 w-3" /></button>
                  </div>
                </div>
              }
              <div class="space-y-2">
                @for (a of assumptions(); track a.id) {
                  <div class="rounded border p-3 group">
                    <p class="text-sm">{{ a.assumption }}</p>
                    <p class="text-xs text-muted-foreground mt-1"><strong>Risk if wrong:</strong> {{ a.riskIfWrong }}</p>
                    <div class="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0 text-destructive" (click)="deleteAssumption(a)"><ng-icon name="lucideTrash2" class="h-3 w-3" /></button>
                    </div>
                  </div>
                }
                @if (assumptions().length === 0 && !addingAssumption()) {
                  <p class="text-sm text-muted-foreground italic">No assumptions defined</p>
                }
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold flex items-center gap-2"><ng-icon name="lucideShield" class="h-5 w-5" /> Constraints ({{ constraints().length }})</h2>
                <button hlmBtn size="sm" variant="ghost" (click)="startAddConstraint()"><ng-icon name="lucidePlus" class="h-4 w-4 mr-1" /> Add</button>
              </div>
              @if (addingConstraint()) {
                <div class="rounded border p-3 bg-muted/30 mb-2">
                  <textarea class="w-full text-sm border rounded px-2 py-1 mb-1" [(ngModel)]="newConstraint.constraint" placeholder="Constraint description" rows="2"></textarea>
                  <select class="w-full text-xs border rounded px-2 py-1 mb-1" [(ngModel)]="newConstraint.category">
                    <option value="technical">Technical</option>
                    <option value="budget">Budget</option>
                    <option value="timeline">Timeline</option>
                    <option value="regulatory">Regulatory</option>
                    <option value="resource">Resource</option>
                  </select>
                  <textarea class="w-full text-xs border rounded px-2 py-1" [(ngModel)]="newConstraint.impact" placeholder="Impact" rows="2"></textarea>
                  <div class="flex gap-1 mt-2">
                    <button hlmBtn size="sm" variant="default" (click)="saveNewConstraint()"><ng-icon name="lucideCheck" class="h-3 w-3 mr-1" /> Add</button>
                    <button hlmBtn size="sm" variant="ghost" (click)="cancelAddConstraint()"><ng-icon name="lucideX" class="h-3 w-3" /></button>
                  </div>
                </div>
              }
              <div class="space-y-2">
                @for (c of constraints(); track c.id) {
                  <div class="rounded border p-3 group">
                    <div class="flex items-center gap-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">{{ c.category }}</span></div>
                    <p class="text-sm mt-1">{{ c.constraint }}</p>
                    <p class="text-xs text-muted-foreground mt-1"><strong>Impact:</strong> {{ c.impact }}</p>
                    <div class="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0 text-destructive" (click)="deleteConstraint(c)"><ng-icon name="lucideTrash2" class="h-3 w-3" /></button>
                    </div>
                  </div>
                }
                @if (constraints().length === 0 && !addingConstraint()) {
                  <p class="text-sm text-muted-foreground italic">No constraints defined</p>
                }
              </div>
            </div>
          </div>

          <!-- Deliverables -->
          <div class="mb-8">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold flex items-center gap-2"><ng-icon name="lucidePackage" class="h-5 w-5" /> Deliverables ({{ deliverables().length }})</h2>
              <button hlmBtn size="sm" variant="ghost" (click)="startAddDeliverable()"><ng-icon name="lucidePlus" class="h-4 w-4 mr-1" /> Add</button>
            </div>
            @if (addingDeliverable()) {
              <div class="rounded-lg border p-4 bg-muted/30 mb-4">
                <input type="text" class="w-full text-sm font-medium border rounded px-2 py-1 mb-2" [(ngModel)]="newDeliverable.name" placeholder="Deliverable name" />
                <textarea class="w-full text-xs border rounded px-2 py-1 mb-2" [(ngModel)]="newDeliverable.description" placeholder="Description" rows="2"></textarea>
                <select class="w-full text-xs border rounded px-2 py-1 mb-2" [(ngModel)]="newDeliverable.type">
                  <option value="feature">Feature</option>
                  <option value="document">Document</option>
                  <option value="api">API</option>
                  <option value="integration">Integration</option>
                  <option value="deployment">Deployment</option>
                </select>
                <textarea class="w-full text-xs border rounded px-2 py-1" [(ngModel)]="newDeliverable.acceptanceCriteria" placeholder="Acceptance criteria (one per line)" rows="3"></textarea>
                <div class="flex gap-1 mt-2">
                  <button hlmBtn size="sm" variant="default" (click)="saveNewDeliverable()"><ng-icon name="lucideCheck" class="h-3 w-3 mr-1" /> Add</button>
                  <button hlmBtn size="sm" variant="ghost" (click)="cancelAddDeliverable()"><ng-icon name="lucideX" class="h-3 w-3" /></button>
                </div>
              </div>
            }
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (d of deliverables(); track d.id) {
                <div class="rounded-lg border p-4 group">
                  <div class="flex items-center gap-2 mb-1"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">{{ d.type }}</span><h3 class="font-medium text-sm">{{ d.name }}</h3></div>
                  <p class="text-xs text-muted-foreground">{{ d.description }}</p>
                  @if (d.acceptanceCriteria && d.acceptanceCriteria.length > 0) {
                    <div class="mt-2"><strong class="text-xs">Acceptance:</strong><ul class="text-xs list-disc list-inside">@for (ac of d.acceptanceCriteria; track ac) { <li>{{ ac }}</li> }</ul></div>
                  }
                  <div class="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button hlmBtn size="sm" variant="ghost" class="h-6 w-6 p-0 text-destructive" (click)="deleteDeliverable(d)"><ng-icon name="lucideTrash2" class="h-3 w-3" /></button>
                  </div>
                </div>
              }
              @if (deliverables().length === 0 && !addingDeliverable()) {
                <p class="text-sm text-muted-foreground italic">No deliverables defined</p>
              }
            </div>
          </div>

          <!-- Next Steps CTA -->
          <div class="mt-8 pt-6 border-t">
            <h3 class="text-lg font-semibold mb-4">Continue Your Workflow</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button hlmBtn class="w-full justify-start" (click)="continueToScopeMonitor()">
                <ng-icon name="lucideActivity" class="mr-3 h-5 w-5" />
                <div class="text-left">
                  <div class="font-medium">Monitor Scope Changes</div>
                  <div class="text-xs text-primary-foreground/70">Track scope creep and manage change requests</div>
                </div>
                <ng-icon name="lucideChevronRight" class="ml-auto h-5 w-5" />
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .cdk-drag-preview { box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2), 0 8px 10px 1px rgba(0, 0, 0, 0.14), 0 3px 14px 2px rgba(0, 0, 0, 0.12); border-radius: 4px; }
    .cdk-drag-placeholder { opacity: 0.3; }
    .cdk-drag-animating { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }
    .cdk-drop-list-dragging .cdk-drag { transition: transform 250ms cubic-bezier(0, 0, 0.2, 1); }
  `,
})
export class ScopeDefinitionResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ScopeDefinitionService);

  session = signal<ScopeDefinitionSession | null>(null);
  inScopeItems = signal<ScopeItem[]>([]);
  outOfScopeItems = signal<ScopeItem[]>([]);
  deferredItems = signal<ScopeItem[]>([]);
  assumptions = signal<ScopeAssumption[]>([]);
  constraints = signal<ScopeConstraint[]>([]);
  deliverables = signal<ScopeDeliverable[]>([]);
  isLoading = signal(true);

  // Editing state
  editingItemId = signal<number | null>(null);
  editingItem = { title: '', description: '' };

  // Adding state
  addingItemType = signal<'in_scope' | 'out_of_scope' | 'deferred' | null>(null);
  newItem = { title: '', description: '' };
  addingAssumption = signal(false);
  newAssumption = { assumption: '', riskIfWrong: '' };
  addingConstraint = signal(false);
  newConstraint = { constraint: '', category: 'technical', impact: '' };
  addingDeliverable = signal(false);
  newDeliverable = { name: '', description: '', type: 'feature', acceptanceCriteria: '' };

  async ngOnInit() {
    const sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (!sessionId) { this.router.navigate(['/scoping/definition']); return; }
    await this.loadSession(sessionId);
  }

  async loadSession(sessionId: number) {
    this.isLoading.set(true);
    let session = await this.service.getSession(sessionId);
    while (session && (session.status === 'pending' || session.status === 'generating')) {
      this.session.set(session);
      await new Promise((r) => setTimeout(r, 2000));
      session = await this.service.getSession(sessionId);
    }
    if (session) {
      this.session.set(session);
      if (session.status === 'completed') {
        const fullData = await this.service.getSessionFull(sessionId);
        if (fullData) {
          this.inScopeItems.set(fullData.in_scope_items);
          this.outOfScopeItems.set(fullData.out_of_scope_items);
          this.deferredItems.set(fullData.deferred_items);
          this.assumptions.set(fullData.assumptions);
          this.constraints.set(fullData.constraints);
          this.deliverables.set(fullData.deliverables);
        }
      }
    }
    this.isLoading.set(false);
  }

  // Drag and drop
  async onDrop(event: CdkDragDrop<ScopeItem[]>, newScopeType: 'in_scope' | 'out_of_scope' | 'deferred') {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      // Update signals
      this.inScopeItems.set([...this.inScopeItems()]);
      this.outOfScopeItems.set([...this.outOfScopeItems()]);
      this.deferredItems.set([...this.deferredItems()]);
      // Update backend
      const item = event.container.data[event.currentIndex];
      await this.service.updateScopeItem(item.id, { scopeType: newScopeType });
    }
  }

  // Edit item
  startEdit(item: ScopeItem) {
    this.editingItemId.set(item.id);
    this.editingItem = { title: item.title, description: item.description };
  }

  cancelEdit() {
    this.editingItemId.set(null);
    this.editingItem = { title: '', description: '' };
  }

  async saveItem(item: ScopeItem) {
    const updated = await this.service.updateScopeItem(item.id, { title: this.editingItem.title, description: this.editingItem.description });
    if (updated) {
      // Update local state
      const updateList = (items: ScopeItem[]) => items.map(i => i.id === item.id ? { ...i, ...updated } : i);
      this.inScopeItems.set(updateList(this.inScopeItems()));
      this.outOfScopeItems.set(updateList(this.outOfScopeItems()));
      this.deferredItems.set(updateList(this.deferredItems()));
    }
    this.cancelEdit();
  }

  // Delete methods
  async deleteItem(item: ScopeItem) {
    if (!confirm('Delete this item?')) return;
    if (await this.service.deleteScopeItem(item.id)) {
      this.inScopeItems.set(this.inScopeItems().filter(i => i.id !== item.id));
      this.outOfScopeItems.set(this.outOfScopeItems().filter(i => i.id !== item.id));
      this.deferredItems.set(this.deferredItems().filter(i => i.id !== item.id));
    }
  }

  async deleteAssumption(a: ScopeAssumption) {
    if (!confirm('Delete this assumption?')) return;
    if (await this.service.deleteAssumption(a.id)) {
      this.assumptions.set(this.assumptions().filter(i => i.id !== a.id));
    }
  }

  async deleteConstraint(c: ScopeConstraint) {
    if (!confirm('Delete this constraint?')) return;
    if (await this.service.deleteConstraint(c.id)) {
      this.constraints.set(this.constraints().filter(i => i.id !== c.id));
    }
  }

  async deleteDeliverable(d: ScopeDeliverable) {
    if (!confirm('Delete this deliverable?')) return;
    if (await this.service.deleteDeliverable(d.id)) {
      this.deliverables.set(this.deliverables().filter(i => i.id !== d.id));
    }
  }

  // Add scope item
  startAddItem(scopeType: 'in_scope' | 'out_of_scope' | 'deferred') {
    this.addingItemType.set(scopeType);
    this.newItem = { title: '', description: '' };
  }

  cancelAdd() {
    this.addingItemType.set(null);
    this.newItem = { title: '', description: '' };
  }

  async saveNewItem(scopeType: 'in_scope' | 'out_of_scope' | 'deferred') {
    if (!this.newItem.title.trim()) return;
    const sessionId = this.session()?.id;
    if (!sessionId) return;
    const created = await this.service.createScopeItem(sessionId, { title: this.newItem.title, description: this.newItem.description, scopeType });
    if (created) {
      if (scopeType === 'in_scope') this.inScopeItems.set([...this.inScopeItems(), created]);
      else if (scopeType === 'out_of_scope') this.outOfScopeItems.set([...this.outOfScopeItems(), created]);
      else this.deferredItems.set([...this.deferredItems(), created]);
    }
    this.cancelAdd();
  }

  // Add assumption
  startAddAssumption() { this.addingAssumption.set(true); this.newAssumption = { assumption: '', riskIfWrong: '' }; }
  cancelAddAssumption() { this.addingAssumption.set(false); this.newAssumption = { assumption: '', riskIfWrong: '' }; }
  async saveNewAssumption() {
    if (!this.newAssumption.assumption.trim()) return;
    const sessionId = this.session()?.id;
    if (!sessionId) return;
    const created = await this.service.createAssumption(sessionId, this.newAssumption);
    if (created) this.assumptions.set([...this.assumptions(), created]);
    this.cancelAddAssumption();
  }

  // Add constraint
  startAddConstraint() { this.addingConstraint.set(true); this.newConstraint = { constraint: '', category: 'technical', impact: '' }; }
  cancelAddConstraint() { this.addingConstraint.set(false); this.newConstraint = { constraint: '', category: 'technical', impact: '' }; }
  async saveNewConstraint() {
    if (!this.newConstraint.constraint.trim()) return;
    const sessionId = this.session()?.id;
    if (!sessionId) return;
    const created = await this.service.createConstraint(sessionId, this.newConstraint);
    if (created) this.constraints.set([...this.constraints(), created]);
    this.cancelAddConstraint();
  }

  // Add deliverable
  startAddDeliverable() { this.addingDeliverable.set(true); this.newDeliverable = { name: '', description: '', type: 'feature', acceptanceCriteria: '' }; }
  cancelAddDeliverable() { this.addingDeliverable.set(false); this.newDeliverable = { name: '', description: '', type: 'feature', acceptanceCriteria: '' }; }
  async saveNewDeliverable() {
    if (!this.newDeliverable.name.trim()) return;
    const sessionId = this.session()?.id;
    if (!sessionId) return;
    const acList = this.newDeliverable.acceptanceCriteria.split('\n').filter(s => s.trim());
    const created = await this.service.createDeliverable(sessionId, { name: this.newDeliverable.name, description: this.newDeliverable.description, type: this.newDeliverable.type, acceptanceCriteria: acList });
    if (created) this.deliverables.set([...this.deliverables(), created]);
    this.cancelAddDeliverable();
  }

  async retry() { const id = this.session()?.id; if (id) { this.isLoading.set(true); await this.service.retrySession(id); await this.loadSession(id); } }
  goBack() { this.router.navigate(['/scoping/definition']); }

  continueToScopeMonitor() {
    const sessionId = this.session()?.id;
    if (sessionId) {
      this.router.navigate(['/scoping/monitor'], { queryParams: { scopeDefinitionId: sessionId } });
    }
  }

  exportToPdf() {
    const session = this.session();
    const inScope = this.inScopeItems();
    const outOfScope = this.outOfScopeItems();
    const deferred = this.deferredItems();
    const assumptions = this.assumptions();
    const constraints = this.constraints();
    const deliverables = this.deliverables();

    if (!session) return;

    const renderScopeItems = (items: ScopeItem[], borderColor: string) => {
      if (items.length === 0) return '<p class="empty">No items</p>';
      return items.map(item => `
        <div class="scope-item" style="border-left-color: ${borderColor};">
          <h4>${item.title}</h4>
          <p>${item.description}</p>
        </div>
      `).join('');
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Scope Definition - ${session.projectName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1a1a2e; padding: 48px; max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 3px solid #006450; }
    .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; color: #006450; }
    .header .subtitle { font-size: 14px; color: #64748b; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
    .section-title .count { font-size: 14px; color: #64748b; font-weight: 400; }
    .scope-statement { background: #f0fdf4; padding: 20px; border-radius: 12px; border-left: 4px solid #006450; margin-bottom: 24px; }
    .scope-statement p { color: #374151; }
    .scope-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .scope-column { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .scope-column h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
    .scope-column h3 .dot { width: 10px; height: 10px; border-radius: 50%; }
    .scope-column h3 .dot.green { background: #22c55e; }
    .scope-column h3 .dot.red { background: #ef4444; }
    .scope-column h3 .dot.amber { background: #f59e0b; }
    .scope-item { padding: 12px; border-left: 3px solid #e2e8f0; margin-bottom: 10px; background: #fafafa; border-radius: 0 6px 6px 0; }
    .scope-item h4 { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
    .scope-item p { font-size: 12px; color: #64748b; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .card h3 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .assumption-item, .constraint-item { padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 10px; }
    .assumption-item p, .constraint-item p { font-size: 13px; }
    .assumption-item .risk { font-size: 12px; color: #64748b; margin-top: 6px; }
    .constraint-item .category { display: inline-block; padding: 2px 8px; background: #f1f5f9; border-radius: 10px; font-size: 11px; font-weight: 500; color: #475569; margin-bottom: 6px; }
    .constraint-item .impact { font-size: 12px; color: #64748b; margin-top: 6px; }
    .deliverables-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .deliverable { padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; }
    .deliverable .type { display: inline-block; padding: 3px 10px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 11px; font-weight: 500; margin-bottom: 8px; }
    .deliverable h4 { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
    .deliverable p { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .deliverable .acceptance { font-size: 12px; }
    .deliverable .acceptance strong { display: block; margin-bottom: 4px; }
    .deliverable .acceptance ul { margin-left: 16px; }
    .deliverable .acceptance li { margin-bottom: 2px; }
    .empty { font-size: 13px; color: #94a3b8; font-style: italic; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print { body { padding: 24px; } .section { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${session.projectName}</h1>
    <div class="subtitle">Scope Definition Results</div>
  </div>

  ${session.scopeStatement ? `
  <div class="section">
    <h2 class="section-title">Scope Statement</h2>
    <div class="scope-statement">
      <p>${session.scopeStatement}</p>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">Scope Items</h2>
    <div class="scope-grid">
      <div class="scope-column">
        <h3><span class="dot green"></span> In Scope (${inScope.length})</h3>
        ${renderScopeItems(inScope, '#22c55e')}
      </div>
      <div class="scope-column">
        <h3><span class="dot red"></span> Out of Scope (${outOfScope.length})</h3>
        ${renderScopeItems(outOfScope, '#ef4444')}
      </div>
      <div class="scope-column">
        <h3><span class="dot amber"></span> Deferred (${deferred.length})</h3>
        ${renderScopeItems(deferred, '#f59e0b')}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="two-column">
      <div class="card">
        <h3>Assumptions (${assumptions.length})</h3>
        ${assumptions.length === 0 ? '<p class="empty">No assumptions defined</p>' : assumptions.map(a => `
          <div class="assumption-item">
            <p>${a.assumption}</p>
            <p class="risk"><strong>Risk if wrong:</strong> ${a.riskIfWrong}</p>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <h3>Constraints (${constraints.length})</h3>
        ${constraints.length === 0 ? '<p class="empty">No constraints defined</p>' : constraints.map(c => `
          <div class="constraint-item">
            <span class="category">${c.category}</span>
            <p>${c.constraint}</p>
            <p class="impact"><strong>Impact:</strong> ${c.impact}</p>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Deliverables <span class="count">(${deliverables.length})</span></h2>
    ${deliverables.length === 0 ? '<p class="empty">No deliverables defined</p>' : `
    <div class="deliverables-grid">
      ${deliverables.map(d => `
        <div class="deliverable">
          <span class="type">${d.type}</span>
          <h4>${d.name}</h4>
          <p>${d.description}</p>
          ${d.acceptanceCriteria && d.acceptanceCriteria.length > 0 ? `
            <div class="acceptance">
              <strong>Acceptance Criteria:</strong>
              <ul>
                ${d.acceptanceCriteria.map(ac => `<li>${ac}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    `}
  </div>

  <div class="footer">
    Generated by Product Studio &bull; ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }
}
