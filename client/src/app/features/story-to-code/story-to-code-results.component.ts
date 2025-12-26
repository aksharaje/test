import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DatePipe, CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideDownload,
    lucideFileCode,
    lucideArrowLeft,
    lucideRotateCw,
    lucideCopy,
    lucideCheck,
    lucideFolder,
    lucideFile,
} from '@ng-icons/lucide';
import { StoryToCodeService } from './story-to-code.service';
import { HlmButtonDirective } from '../../ui/button';
import { MarkdownModule } from 'ngx-markdown';

interface FileTreeNode {
    name: string;
    path: string;
    isFolder: boolean;
    children?: FileTreeNode[];
}

@Component({
    selector: 'app-story-to-code-results',
    standalone: true,
    imports: [NgIcon, HlmButtonDirective, MarkdownModule, DatePipe, CommonModule],
    viewProviders: [
        provideIcons({
            lucideDownload,
            lucideFileCode,
            lucideArrowLeft,
            lucideRotateCw,
            lucideCopy,
            lucideCheck,
            lucideFolder,
            lucideFile,
        }),
    ],
    template: `
        <div class="h-full flex flex-col">
            <!-- Header -->
            <div class="border-b bg-card px-6 py-4 flex items-center justify-between shrink-0">
                <div class="flex items-center gap-4">
                    <button
                        hlmBtn variant="ghost" size="sm"
                        (click)="goBack()"
                    >
                        <ng-icon name="lucideArrowLeft" class="mr-2 h-4 w-4" />
                        Back
                    </button>
                    <div>
                        <h1 class="text-lg font-semibold">{{ session()?.title }}</h1>
                        <p class="text-sm text-muted-foreground">
                            Generated {{ session()?.completedAt | date:'medium' }}
                            @if (session()?.generationMetadata?.fileCount) {
                                - {{ session()?.generationMetadata?.fileCount }} files
                            }
                        </p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button
                        hlmBtn variant="outline"
                        (click)="reprocess()"
                    >
                        <ng-icon name="lucideRotateCw" class="mr-2 h-4 w-4" />
                        Regenerate
                    </button>
                    <button
                        hlmBtn
                        (click)="download()"
                    >
                        <ng-icon name="lucideDownload" class="mr-2 h-4 w-4" />
                        Download ZIP
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="flex-1 flex overflow-hidden">
                <!-- File Tree -->
                <div class="w-72 border-r bg-muted/20 overflow-auto shrink-0">
                    <div class="p-3 border-b bg-muted/30">
                        <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Files
                        </p>
                    </div>
                    <div class="p-2">
                        @for (node of fileTree(); track node.path) {
                            <ng-container *ngTemplateOutlet="fileTreeNode; context: { node, depth: 0 }"></ng-container>
                        }
                    </div>
                </div>

                <!-- Code Viewer -->
                <div class="flex-1 overflow-hidden flex flex-col bg-[#0d1117]">
                    @if (selectedFile()) {
                        <!-- File Header -->
                        <div class="sticky top-0 z-10 bg-slate-800 text-slate-200 px-4 py-2 flex items-center justify-between border-b border-slate-700 shrink-0">
                            <span class="text-sm font-mono">{{ selectedFile() }}</span>
                            <button
                                class="text-xs px-2 py-1 rounded hover:bg-slate-700 transition-colors flex items-center gap-1"
                                (click)="copyToClipboard()"
                            >
                                @if (copied()) {
                                    <ng-icon name="lucideCheck" class="h-3 w-3 text-green-400" />
                                    Copied!
                                } @else {
                                    <ng-icon name="lucideCopy" class="h-3 w-3" />
                                    Copy
                                }
                            </button>
                        </div>
                        <!-- Code Content -->
                        <div class="flex-1 overflow-auto p-4">
                            <markdown [data]="markdownContent()"></markdown>
                        </div>
                    } @else {
                        <div class="h-full flex flex-col items-center justify-center text-slate-400">
                            <ng-icon name="lucideFileCode" class="h-12 w-12 opacity-30 mb-4" />
                            <p>Select a file to view code</p>
                        </div>
                    }
                </div>
            </div>
        </div>

        <!-- File Tree Node Template -->
        <ng-template #fileTreeNode let-node="node" let-depth="depth">
            @if (node.isFolder) {
                <div>
                    <button
                        class="w-full text-left px-2 py-1.5 rounded text-sm text-foreground hover:bg-muted flex items-center gap-2"
                        [style.paddingLeft.px]="depth * 16 + 8"
                        (click)="toggleFolder(node.path)"
                    >
                        <ng-icon name="lucideFolder" class="h-4 w-4 text-yellow-500" />
                        <span>{{ node.name }}</span>
                    </button>
                    @if (isFolderOpen(node.path)) {
                        @for (child of node.children; track child.path) {
                            <ng-container *ngTemplateOutlet="fileTreeNode; context: { node: child, depth: depth + 1 }"></ng-container>
                        }
                    }
                </div>
            } @else {
                <button
                    class="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted flex items-center gap-2 font-mono truncate"
                    [class.bg-accent]="selectedFile() === node.path"
                    [class.text-accent-foreground]="selectedFile() === node.path"
                    [class.text-foreground]="selectedFile() !== node.path"
                    [style.paddingLeft.px]="depth * 16 + 8"
                    (click)="selectFile(node.path)"
                >
                    <ng-icon name="lucideFile" class="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span class="truncate">{{ node.name }}</span>
                </button>
            }
        </ng-template>
    `,
    styles: `
        :host {
            display: block;
            height: 100%;
        }
    `,
})
export class StoryToCodeResultsComponent implements OnInit {
    service = inject(StoryToCodeService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    selectedFile = signal<string | null>(null);
    copied = signal(false);
    openFolders = signal<Set<string>>(new Set());

    session = computed(() => this.service.currentSession());

    files = computed(() => {
        const filesMap = this.session()?.generatedFiles || {};
        return Object.keys(filesMap).sort();
    });

    fileTree = computed(() => {
        const files = this.files();
        return this.buildFileTree(files);
    });

    markdownContent = computed(() => {
        const file = this.selectedFile();
        if (!file) return '';
        const lang = this.getLang(file);
        const content = this.getFileContent(file);
        return '```' + lang + '\n' + content + '\n```';
    });

    async ngOnInit() {
        const id = parseInt(this.route.snapshot.paramMap.get('id') || '0', 10);
        if (id) {
            await this.service.getSession(id);
            // Auto-select first file
            const files = this.files();
            if (files.length > 0) {
                this.selectedFile.set(files[0]);
                // Open all parent folders
                this.openFolders.set(new Set(['']));
            }
        } else {
            this.router.navigate(['/story-to-code']);
        }
    }

    buildFileTree(paths: string[]): FileTreeNode[] {
        const root: FileTreeNode[] = [];
        const folderMap = new Map<string, FileTreeNode>();

        // Sort paths to ensure folders come before their contents
        const sortedPaths = [...paths].sort();

        for (const path of sortedPaths) {
            const parts = path.split('/');
            let currentLevel = root;
            let currentPath = '';

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = i === parts.length - 1;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (isLast) {
                    // It's a file
                    currentLevel.push({
                        name: part,
                        path: path,
                        isFolder: false,
                    });
                } else {
                    // It's a folder
                    let folder = folderMap.get(currentPath);
                    if (!folder) {
                        folder = {
                            name: part,
                            path: currentPath,
                            isFolder: true,
                            children: [],
                        };
                        folderMap.set(currentPath, folder);
                        currentLevel.push(folder);
                    }
                    currentLevel = folder.children!;
                }
            }
        }

        return root;
    }

    toggleFolder(path: string) {
        this.openFolders.update(folders => {
            const newFolders = new Set(folders);
            if (newFolders.has(path)) {
                newFolders.delete(path);
            } else {
                newFolders.add(path);
            }
            return newFolders;
        });
    }

    isFolderOpen(path: string): boolean {
        return this.openFolders().has(path);
    }

    selectFile(path: string) {
        this.selectedFile.set(path);
    }

    getFileContent(filename: string | null): string {
        if (!filename) return '';
        return this.session()?.generatedFiles?.[filename] || '';
    }

    getLang(filename: string | null): string {
        if (!filename) return '';
        if (filename.endsWith('.py')) return 'python';
        if (filename.endsWith('.ts')) return 'typescript';
        if (filename.endsWith('.tsx')) return 'tsx';
        if (filename.endsWith('.js')) return 'javascript';
        if (filename.endsWith('.jsx')) return 'jsx';
        if (filename.endsWith('.json')) return 'json';
        if (filename.endsWith('.html')) return 'html';
        if (filename.endsWith('.css')) return 'css';
        if (filename.endsWith('.scss')) return 'scss';
        if (filename.endsWith('.md')) return 'markdown';
        if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return 'yaml';
        if (filename.endsWith('.sql')) return 'sql';
        if (filename.endsWith('.sh')) return 'bash';
        if (filename.endsWith('.go')) return 'go';
        if (filename.endsWith('.rs')) return 'rust';
        if (filename.endsWith('.java')) return 'java';
        if (filename.endsWith('.xml')) return 'xml';
        return '';
    }

    async copyToClipboard() {
        const content = this.getFileContent(this.selectedFile());
        if (content) {
            await navigator.clipboard.writeText(content);
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 2000);
        }
    }

    download() {
        const id = this.session()?.id;
        if (id) {
            this.service.downloadZip(id);
        }
    }

    reprocess() {
        const id = this.session()?.id;
        if (id) {
            this.service.retrySession(id);
            this.router.navigate(['/story-to-code/processing', id]);
        }
    }

    goBack() {
        this.service.clearCurrentSession();
        this.router.navigate(['/story-to-code']);
    }
}
