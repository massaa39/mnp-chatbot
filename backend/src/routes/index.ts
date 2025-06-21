import { Router } from 'express';
import chatRoutes from './api/chat';
import escalationRoutes from './api/escalation';
import faqRoutes from './api/faq';
import authRoutes from './api/auth';

const router = Router();

// API Routes
router.use('/chat', chatRoutes);
router.use('/escalation', escalationRoutes);
router.use('/faq', faqRoutes);
router.use('/auth', authRoutes);

// Health check route (for internal use)
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'mnp-chatbot-api'
  });
});

export default router;