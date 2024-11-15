const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    // TODO: Sauvegarder la candidature
    // TODO: Envoyer un email de confirmation
    res.status(201).json({ message: 'Candidature enregistrée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;