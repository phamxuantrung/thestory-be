const express = require('express');
const router = express.Router();
const { createLetter, getLetters, updateLetter, deleteLetter } = require('../controllers/futureLetterController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, createLetter);
router.get('/', protect, getLetters);
router.put('/:id', protect, updateLetter);
router.delete('/:id', protect, deleteLetter);

module.exports = router;
