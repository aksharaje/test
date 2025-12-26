import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrdGeneratorComponent } from './prd-generator.component';
import { PrdGeneratorService } from './prd-generator.service';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import * as icons from '@ng-icons/lucide';
import { vi } from 'vitest';

// Mock types
interface MockPrd {
    id: number;
    title: string;
    status: string;
    createdAt: Date;
}

describe('PrdGeneratorComponent', () => {
    let component: PrdGeneratorComponent;
    let fixture: ComponentFixture<PrdGeneratorComponent>;
    let mockService: any;
    let mockRouter: any;

    beforeEach(async () => {
        // Mock Service with Signals
        mockService = {
            prds: signal<MockPrd[]>([
                { id: 1, title: 'Prd 1', status: 'pending', createdAt: new Date() }
            ]),
            templates: signal([{ id: 1, name: 'Default', description: 'Desc', isDefault: 1 }]),
            knowledgeBases: signal([]),
            loading: signal(false),
            generating: signal(false),
            error: signal(null),
            hasPrds: signal(true),
            defaultTemplate: signal({ id: 1, name: 'Default' }),
            statusMap: {
                pending: { label: 'Pending', icon: 'lucideLoader2', class: 'text-muted-foreground' },
                processing: { label: 'Processing', icon: 'lucideLoader2', class: 'text-blue-500 animate-spin' },
                draft: { label: 'Draft', icon: 'lucideFileText', class: 'text-orange-500' },
                final: { label: 'Final', icon: 'lucideCheckCircle', class: 'text-green-500' },
                failed: { label: 'Failed', icon: 'lucideAlertCircle', class: 'text-destructive' }
            },
            loadPrds: vi.fn().mockResolvedValue(undefined),
            loadTemplates: vi.fn().mockResolvedValue(undefined),
            loadKnowledgeBases: vi.fn().mockResolvedValue(undefined),
            generate: vi.fn().mockResolvedValue({ id: 2 }),
            retryPrd: vi.fn().mockResolvedValue({ id: 1 }),
            deletePrd: vi.fn().mockResolvedValue(true),
            clearError: vi.fn()
        };

        mockRouter = {
            navigate: vi.fn()
        };

        await TestBed.configureTestingModule({
            imports: [PrdGeneratorComponent, CommonModule, FormsModule, NgIcon], // Standalone component
            providers: [
                { provide: PrdGeneratorService, useValue: mockService },
                { provide: Router, useValue: mockRouter },
                provideIcons(icons)
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PrdGeneratorComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load initial data on init', () => {
        expect(mockService.loadPrds).toHaveBeenCalled();
        expect(mockService.loadTemplates).toHaveBeenCalled();
        expect(mockService.loadKnowledgeBases).toHaveBeenCalled();
    });

    it('should navigate to wizard steps', () => {
        // Initial step is input
        expect((component as any).currentStep()).toBe('input'); // Default

        // Move to next step (Template) - requires concept
        (component as any).concept = 'New Concept';
        component.goToTemplateStep();
        expect((component as any).currentStep()).toBe('template');
    });

    it('should call generate service when finishing wizard', async () => {
        (component as any).concept = 'Concept';
        (component as any).currentStep.set('template'); // Skip to template step

        await component.generatePrd();


        expect(mockService.generate).toHaveBeenCalled();
        // Should navigate to output
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/prd-generator/output', 2]);
    });

    it('should handle retry from history', async () => {
        const event = new MouseEvent('click');
        event.stopPropagation = vi.fn();

        await component.retryPrd(1, event);
        expect(mockService.retryPrd).toHaveBeenCalledWith(1);
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/prd-generator/output', 1]);
    });

    it('should handle delete from history', async () => {
        const event = new MouseEvent('click');
        event.stopPropagation = vi.fn();
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        await component.deletePrd(1, event);
        expect(mockService.deletePrd).toHaveBeenCalledWith(1);
    });
});
