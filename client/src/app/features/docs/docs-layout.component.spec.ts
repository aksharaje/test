import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocsLayoutComponent } from './docs-layout.component';
import { DocsService } from './docs.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
import { describe, beforeEach, it, expect, afterEach } from 'vitest';

describe('DocsLayoutComponent', () => {
    let component: DocsLayoutComponent;
    let fixture: ComponentFixture<DocsLayoutComponent>;
    let docsServiceMock: any;

    beforeEach(async () => {
        docsServiceMock = {
            manifest: signal([
                { name: 'Research Planner', filename: 'research.md', category: 'Research', summary: 'test' },
                { name: 'Ideation', filename: 'ideation.md', category: 'Ideation', summary: 'test' },
                { name: 'Settings', filename: 'settings.md', category: 'Core', summary: 'test' },
                { name: 'Unknown', filename: 'unknown.md', category: undefined, summary: 'test' }
            ]),
            isLoading: signal(false)
        };

        await TestBed.configureTestingModule({
            imports: [DocsLayoutComponent, RouterTestingModule],
            providers: [
                { provide: DocsService, useValue: docsServiceMock },
            ]
        })
            .compileComponents();

        fixture = TestBed.createComponent(DocsLayoutComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should correctly group categories', () => {
        const categories = component.categories();

        const researchGroup = categories.find(c => c.name === 'Research');
        expect(researchGroup).toBeTruthy();
        expect(researchGroup?.items.length).toBe(1);

        const coreGroup = categories.find(c => c.name === 'Core');
        expect(coreGroup).toBeTruthy();

        const generalGroup = categories.find(c => c.name === 'General');
        expect(generalGroup).toBeTruthy();
    });

    it('should respect exact order of categories', () => {
        const categories = component.categories();
        const names = categories.map(c => c.name);

        expect(names.indexOf('Research')).toBeLessThan(names.indexOf('Core'));
        expect(names.indexOf('Core')).toBeLessThan(names.indexOf('General'));
    });
});
