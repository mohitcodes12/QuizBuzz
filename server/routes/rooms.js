import { Router } from 'express';
import { createRoom, getRoom } from '../controllers/roomController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.post('/', asyncHandler(createRoom));
router.get('/:code', asyncHandler(getRoom));

export default router;
