const express = require('express');
const router = express.Router();
const property = require('../models/Property');

// Obtenir toutes les propriétés
router.get('/', async (req, res) => {
  try {
    const Properties = await property.findAll();
    res.json(Properties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ajouter une nouvelle propriété
router.post('/', async (req, res) => {
  try {
    const newProperty = await property.create(req.body);
    res.status(201).json(newProperty);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Ajouter d'autres routes comme Modifier et Supprimer...

module.exports = router;
