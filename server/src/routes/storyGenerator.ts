import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  storyGeneratorService,
  type ArtifactType,
  type GenerateRequest,
} from '../services/storyGenerator.js';

const router = Router();

// Configure multer for file uploads (images, PDFs, Word docs)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max per file
    files: 10, // Max 10 files
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// GET /api/story-generator/config/:type - Get input configuration for artifact type
router.get('/config/:type', (req: Request, res: Response) => {
  const type = req.params.type as ArtifactType;
  if (!['epic', 'feature', 'user_story'].includes(type)) {
    return res.status(400).json({ error: 'Invalid artifact type' });
  }

  const config = storyGeneratorService.getInputConfig(type);
  res.json(config);
});

// POST /api/story-generator/generate - Generate new artifact
router.post('/generate', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const { type, title, description, knowledgeBaseIds } = req.body;

    // Validate type
    if (!type || !['epic', 'feature', 'user_story'].includes(type)) {
      return res.status(400).json({ error: 'Invalid artifact type. Must be epic, feature, or user_story' });
    }

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Validate description
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Parse knowledge base IDs
    let parsedKbIds: number[] = [];
    if (knowledgeBaseIds) {
      try {
        parsedKbIds = typeof knowledgeBaseIds === 'string'
          ? JSON.parse(knowledgeBaseIds)
          : knowledgeBaseIds;
        if (!Array.isArray(parsedKbIds)) {
          parsedKbIds = [];
        }
      } catch {
        parsedKbIds = [];
      }
    }

    // Process uploaded files
    const files = (req.files as Express.Multer.File[]) || [];
    const processedFiles = files.map((file) => ({
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      content: file.buffer.toString('base64'),
    }));

    // Generate artifact
    const request: GenerateRequest = {
      type: type as ArtifactType,
      title: title.trim(),
      description: description.trim(),
      files: processedFiles,
      knowledgeBaseIds: parsedKbIds,
    };

    const artifact = await storyGeneratorService.generate(request);
    res.status(201).json(artifact);
  } catch (error) {
    console.error('Generation error:', error);
    const message = error instanceof Error ? error.message : 'Generation failed';
    res.status(500).json({ error: message });
  }
});

// POST /api/story-generator/:id/regenerate - Regenerate with modifications
router.post('/:id/regenerate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { prompt } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid artifact ID' });
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Regeneration prompt is required' });
    }

    const artifact = await storyGeneratorService.regenerate({
      artifactId: id,
      prompt: prompt.trim(),
    });

    res.json(artifact);
  } catch (error) {
    console.error('Regeneration error:', error);
    const message = error instanceof Error ? error.message : 'Regeneration failed';

    if (message === 'Artifact not found') {
      return res.status(404).json({ error: message });
    }

    res.status(500).json({ error: message });
  }
});

// GET /api/story-generator - List all artifacts
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const artifacts = await storyGeneratorService.listArtifacts(userId);
    res.json(artifacts);
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to list artifacts' });
  }
});

// GET /api/story-generator/:id - Get single artifact
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid artifact ID' });
    }

    const artifact = await storyGeneratorService.getArtifact(id);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    res.json(artifact);
  } catch (error) {
    console.error('Get error:', error);
    res.status(500).json({ error: 'Failed to get artifact' });
  }
});

// PATCH /api/story-generator/:id - Update artifact (edit content)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid artifact ID' });
    }

    const { title, content, status } = req.body;
    const updateData: { title?: string; content?: string; status?: 'draft' | 'final' } = {};

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (status !== undefined) {
      if (!['draft', 'final'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be draft or final' });
      }
      updateData.status = status;
    }

    const artifact = await storyGeneratorService.updateArtifact(id, updateData);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    res.json(artifact);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update artifact' });
  }
});

// DELETE /api/story-generator/:id - Delete artifact
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid artifact ID' });
    }

    const deleted = await storyGeneratorService.deleteArtifact(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete artifact' });
  }
});

export default router;
