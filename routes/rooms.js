const express = require('express');
const router = express.Router();
const room = require('../models/Room');
const property = require('../models/Property');

// Middleware de logging
const logRequest = (req, res, next) => {
  next();
};

router.use(logRequest);

// GET tous les chambres



router.get('/', async (req, res) => {
  try {
    // Retirer temporairement l'inclusion de property
    const rooms = await room.findAll();
    res.json(rooms);
  } catch (error) {
    console.error('Erreur détaillée:', error);
    res.status(500).json({ 
      message: "Erreur lors de la récupération des chambres",
      error: error.message 
    });
  }
});

// GET une chambre par ID
router.get('/:id', async (req, res) => {
  try {
    const roomRecord = await room.findByPk(req.params.id, {
      include: [{
        model: property,
        attributes: ['name']
      }]
    });
    if (!roomRecord) {
      return res.status(404).json({ message: "Chambre non trouvée" });
    }
    res.json(roomRecord);
  } catch (error) {
    console.error('Erreur GET /rooms/:id:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST nouvelle chambre
router.post('/', async (req, res) => {
  try {
    const room = await room.create(req.body);
    res.status(201).json(room);
  } catch (error) {
    console.error('Erreur POST /rooms:', error);
    res.status(400).json({ 
      message: "Erreur lors de la création de la chambre",
      error: error.message 
    });
  }
});

// PUT mise à jour d'une chambre
router.put('/:id', async (req, res) => {
  try {
    const room = await room.findByPk(req.params.id);
    if (!room) {
      return res.status(404).json({ message: "Chambre non trouvée" });
    }
    await room.update(req.body);
    res.json(room);
  } catch (error) {
    console.error('Erreur PUT /rooms/:id:', error);
    res.status(400).json({ message: error.message });
  }
});

// DELETE une chambre
router.delete('/:id', async (req, res) => {
  try {
    const room = await room.findByPk(req.params.id);
    if (!room) {
      return res.status(404).json({ message: "Chambre non trouvée" });
    }
    await room.destroy();
    res.json({ message: "Chambre supprimée avec succès" });
  } catch (error) {
    console.error('Erreur DELETE /rooms/:id:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;