import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DocsService, DocManifestItem } from './docs.service';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';

describe('DocsService', () => {
    let service: DocsService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [DocsService]
        });
        service = TestBed.inject(DocsService);
        httpMock = TestBed.inject(HttpTestingController);

        // Flush initial request from constructor
        const req = httpMock.expectOne('/assets/docs/manifest.json');
        req.flush([]);
    });

    afterEach(() => {
        httpMock.verify();
        TestBed.resetTestingModule();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should list manifest items', () => {
        const mockManifest: DocManifestItem[] = [
            { name: 'Service A', filename: 'service-a.md', summary: 'Summary A', category: 'Core' },
            { name: 'Service B', filename: 'service-b.md', summary: 'Summary B', category: 'Research' }
        ];

        service.loadManifest();

        const req = httpMock.expectOne('/assets/docs/manifest.json');
        expect(req.request.method).toBe('GET');
        req.flush(mockManifest);

        expect(service.manifest()).toEqual(mockManifest);
    });

    it('should get doc content', () => {
        const filename = 'test-doc.md';
        const content = '# Test Doc Content';

        service.getDocContent(filename).subscribe(data => {
            expect(data).toBe(content);
        });

        const req = httpMock.expectOne(`/assets/docs/${filename}`);
        expect(req.request.method).toBe('GET');
        req.flush(content);
    });
});
