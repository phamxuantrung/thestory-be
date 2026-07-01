const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getPets,
  buyPet,
  renamePet,
  carePet,
  startExpedition,
  collectExpedition,
  buyFood,
  buyItem,
  sellPet,
  devAction,
  getPartnerPets,
  combatPets,
  setDefenseTeam,
  getCombatHistory
} = require('../controllers/petController');

router.get('/', protect, getPets);
router.get('/partner', protect, getPartnerPets);
router.put('/defense-team', protect, setDefenseTeam);
router.get('/combat-history', protect, getCombatHistory);
router.post('/combat', protect, combatPets);
router.post('/buy', protect, buyPet);
router.post('/buy-food', protect, buyFood);
router.post('/buy-item', protect, buyItem);
router.put('/:id/name', protect, renamePet);
router.post('/:id/care', protect, carePet);
router.post('/:id/expedition/start', protect, startExpedition);
router.post('/:id/expedition/collect', protect, collectExpedition);
router.delete('/:id/sell', protect, sellPet);
router.post('/dev', protect, devAction);

module.exports = router;
