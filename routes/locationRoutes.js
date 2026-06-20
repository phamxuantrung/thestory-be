const express = require('express');
const router = express.Router();
const { addLocation, getLocations, deleteLocation } = require('../controllers/locationController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, addLocation);
router.get('/', protect, getLocations);
router.delete('/:id', protect, deleteLocation);

module.exports = router;
