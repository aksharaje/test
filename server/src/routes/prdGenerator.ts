import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  prdGeneratorService,
  type PrdGenerateRequest,
} from '../services/prdGenerator.js';

const router = Router();

// Configure multer for file uploads
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

// GET /api/prd-generator/templates - Get all available templates
router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await prdGeneratorService.getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Templates fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/prd-generator/templates/:id - Get a specific template
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const template = await prdGeneratorService.getTemplate(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Template fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/prd-generator/generate - Generate new PRD
router.post('/generate', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const {
      concept,
      targetProject,
      targetPersona,
      industryContext,
      primaryMetric,
      userStoryRole,
      userStoryGoal,
      userStoryBenefit,
      knowledgeBaseIds,
      templateId,
    } = req.body;

    // Validate concept
    if (!concept || typeof concept !== 'string' || concept.trim().length === 0) {
      return res.status(400).json({ error: 'Concept is required' });
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

    // Parse template ID
    let parsedTemplateId: number | undefined;
    if (templateId) {
      const parsed = typeof templateId === 'string'
        ? parseInt(templateId)
        : templateId;
      if (!isNaN(parsed)) {
        parsedTemplateId = parsed;
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

    // Generate PRD
    const request: PrdGenerateRequest = {
      concept: concept.trim(),
      targetProject: targetProject?.trim(),
      targetPersona: targetPersona?.trim(),
      industryContext: industryContext?.trim(),
      primaryMetric: primaryMetric?.trim(),
      userStoryRole: userStoryRole?.trim(),
      userStoryGoal: userStoryGoal?.trim(),
      userStoryBenefit: userStoryBenefit?.trim(),
      knowledgeBaseIds: parsedKbIds,
      files: processedFiles,
      templateId: parsedTemplateId,
    };

    const prd = await prdGeneratorService.generate(request);
    res.status(201).json(prd);
  } catch (error) {
    console.error('PRD generation error:', error);
    const message = error instanceof Error ? error.message : 'Generation failed';
    res.status(500).json({ error: message });
  }
});

// POST /api/prd-generator/:id/refine - Refine an existing PRD
router.post('/:id/refine', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { prompt } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid PRD ID' });
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Refine prompt is required' });
    }

    const prd = await prdGeneratorService.refine({
      prdId: id,
      prompt: prompt.trim(),
    });

    res.json(prd);
  } catch (error) {
    console.error('PRD refine error:', error);
    const message = error instanceof Error ? error.message : 'Refine failed';

    if (message === 'PRD not found') {
      return res.status(404).json({ error: message });
    }

    res.status(500).json({ error: message });
  }
});

// GET /api/prd-generator - List all PRDs
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const prds = await prdGeneratorService.listPrds(userId);
    res.json(prds);
  } catch (error) {
    console.error('List PRDs error:', error);
    res.status(500).json({ error: 'Failed to list PRDs' });
  }
});

// GET /api/prd-generator/:id - Get a single PRD
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid PRD ID' });
    }

    const prd = await prdGeneratorService.getPrd(id);
    if (!prd) {
      return res.status(404).json({ error: 'PRD not found' });
    }

    res.json(prd);
  } catch (error) {
    console.error('Get PRD error:', error);
    res.status(500).json({ error: 'Failed to get PRD' });
  }
});

// PATCH /api/prd-generator/:id - Update a PRD
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid PRD ID' });
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

    const prd = await prdGeneratorService.updatePrd(id, updateData);
    if (!prd) {
      return res.status(404).json({ error: 'PRD not found' });
    }

    res.json(prd);
  } catch (error) {
    console.error('Update PRD error:', error);
    res.status(500).json({ error: 'Failed to update PRD' });
  }
});

// DELETE /api/prd-generator/:id - Delete a PRD
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid PRD ID' });
    }

    const deleted = await prdGeneratorService.deletePrd(id);
    if (!deleted) {
      return res.status(404).json({ error: 'PRD not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete PRD error:', error);
    res.status(500).json({ error: 'Failed to delete PRD' });
  }
});

export default router;
