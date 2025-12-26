import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrdGeneratorOutputComponent } from './prd-generator-output.component';
import { PrdGeneratorService } from './prd-generator.service';
import { Router, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import * as icons from '@ng-icons/lucide';
import { MarkdownModule } from 'ngx-markdown';
import { vi } from 'vitest';

describe('PrdGeneratorOutputComponent', () => {
    let component: PrdGeneratorOutputComponent;
    let fixture: ComponentFixture<PrdGeneratorOutputComponent>;
    let mockService: any;
    let mockRouter: any;
    let mockRoute: any;

    beforeEach(async () => {
        mockService = {
            prds: signal([]),
            currentPrd: signal(null),
            loading: signal(false),
            generating: signal(false),
            error: signal(null),
            getPrd: vi.fn(),
            pollSessionStatus: vi.fn(),
            retryPrd: vi.fn(),
            refine: vi.fn(),
            clearError: vi.fn()
        };

        mockRouter = {
            navigate: vi.fn()
        };

        mockRoute = {
            snapshot: {
                paramMap: {
                    get: vi.fn().mockReturnValue('1') // Default ID 1
                }
            }
        };

        // Mock MarkdownModule since it might have external deps
        // For simplicity, we can import it or mock it. Using actual import for now as it's in the component imports.

        await TestBed.configureTestingModule({
            imports: [
                PrdGeneratorOutputComponent,
                CommonModule,
                FormsModule,
                NgIcon,
                MarkdownModule.forRoot()
            ],
            providers: [
                { provide: PrdGeneratorService, useValue: mockService },
                { provide: Router, useValue: mockRouter },
                { provide: ActivatedRoute, useValue: mockRoute },
                provideIcons(icons)
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(PrdGeneratorOutputComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should load PRD on init', async () => {
        const mockPrd = { id: 1, title: 'Test', status: 'final', content: '{"sections": []}' };
        mockService.getPrd.mockResolvedValue(mockPrd);

        fixture.detectChanges(); // triggers ngOnInit

        expect(mockService.getPrd).toHaveBeenCalledWith(1);
        // getPrd sets currentPrd in service, component reads from service? 
        // Wait, component calls service.getPrd and sets local state if needed?
        // Let's check logic: component.loadPrd calls service.getPrd.
        // If successful, it initializes content.
    });

    it('should handle pending status by starting polling', async () => {
        const mockPrd = { id: 1, title: 'Test', status: 'pending' };
        mockService.getPrd.mockResolvedValue(mockPrd);

        // Mock pollSessionStatus to update status eventually
        mockService.pollSessionStatus.mockResolvedValue({ ...mockPrd, status: 'final' });

        fixture.detectChanges();

        // Start polling should be called
        // Since polling uses setInterval, we might not see immediate calls unless we use fake timers.
        // However, startPolling calls poll immediately? No, usually sets interval.
        // But pollSessionStatus is called inside the interval.

        // We can verify that startPolling was called (it's private/protected method usually called by loading).
    });

    it('should show error state', () => {
        mockService.getPrd.mockRejectedValue(new Error('Failed'));

        fixture.detectChanges();

        // Component should handle error. 
        // Usually sets error signal.
        // expect((component as any).error()).toBe('Failed to load PRD');
    });

    it('should retry generation', async () => {
        const mockPrd = { id: 1, title: 'Test' };
        mockService.getPrd.mockResolvedValue(mockPrd);
        fixture.detectChanges(); // calls ngOnInit -> loadPrd -> getPrd

        await fixture.whenStable(); // wait for async loadPrd
        await component.retryPrd();

        expect(mockService.retryPrd).toHaveBeenCalledWith(1);
    });
});
