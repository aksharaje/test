import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import agentRoutes from './routes/agents.js';
import flowRoutes from './routes/flows.js';
import knowledgeBaseRoutes from './routes/knowledgeBases.js';
import storyGeneratorRoutes from './routes/storyGenerator.js';
import storyGeneratorFeedbackRoutes from './routes/storyGeneratorFeedback.js';
import codeChatRoutes from './routes/codeChat.js';
import feedbackRoutes from './routes/feedback.js';
import splitTestRoutes from './routes/splitTests.js';
import optimizeRoutes from './routes/optimize.js';
import flowOptimizeRoutes from './routes/flowOptimize.js';
import { agentService } from './services/agent.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/agents', agentRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/knowledge-bases', knowledgeBaseRoutes);
app.use('/api/story-generator', storyGeneratorRoutes);
app.use('/api/story-generator', storyGeneratorFeedbackRoutes);
app.use('/api/code-chat', codeChatRoutes);
app.use('/api', feedbackRoutes);
app.use('/api', splitTestRoutes);
app.use('/api/optimize', optimizeRoutes);
app.use('/api/optimize', flowOptimizeRoutes);

// Register example tools (you can add more here)
agentService.registerTool('get_current_time', async () => {
  return new Date().toISOString();
});

agentService.registerTool('calculate', async (args) => {
  const { expression } = args as { expression: string };
  try {
    // Simple safe math evaluation (for demo purposes)
    const result = Function(`"use strict"; return (${expression})`)();
    return String(result);
  } catch {
    return 'Error: Invalid expression';
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
