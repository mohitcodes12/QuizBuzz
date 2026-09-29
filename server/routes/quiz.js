import { Router } from 'express';
import {
  createQuiz,
  listMyQuizzes,
  getQuiz,
  updateQuiz,
  deleteQuiz,
} from '../controllers/quizController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// Every quiz route needs a valid JWT
router.use(requireAuth);

router.post('/', asyncHandler(createQuiz));
router.get('/', asyncHandler(listMyQuizzes));
router.get('/:id', asyncHandler(getQuiz));
router.put('/:id', asyncHandler(updateQuiz));
router.delete('/:id', asyncHandler(deleteQuiz));

export default router;
