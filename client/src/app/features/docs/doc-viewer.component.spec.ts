import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocViewerComponent } from './doc-viewer.component';
import { DocsService } from './docs.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MarkdownModule } from 'ngx-markdown';
import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';

describe('DocViewerComponent', () => {
    let component: DocViewerComponent;
    let fixture: ComponentFixture<DocViewerComponent>;
    let docsServiceMock: any;

    beforeEach(async () => {
        docsServiceMock = {
            getDocContent: vi.fn().mockReturnValue(of('# Mock Content'))
        };

        await TestBed.configureTestingModule({
            imports: [
                DocViewerComponent,
                MarkdownModule.forRoot()
            ],
            providers: [
                { provide: DocsService, useValue: docsServiceMock },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        // key === 'id' matches the 'id' parameter in docs.routes.ts and component logic
                        paramMap: of({ get: (key: string) => (key === 'id' ? 'TestDoc' : null) })
                    }
                }
            ]
        })
            .compileComponents();

        fixture = TestBed.createComponent(DocViewerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        TestBed.resetTestingModule();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should fetch content based on route param', async () => {
        // Run change detection
        fixture.detectChanges();
        await fixture.whenStable();
        // 'TestDoc' (from param) -> 'test-doc.md' (component logic transformation)
        expect(docsServiceMock.getDocContent).toHaveBeenCalledWith('test-doc.md');
    });
});
