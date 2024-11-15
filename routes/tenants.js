const express = require('express');
const router = express.Router();
const Tenant = require('../models/Tenant');
const { Op } = require('sequelize');
const {sequelize} = require('../config');

// Récupérer tous les locataires
router.get('/', async (req, res) => {
  try {
    const tenants = await Tenant.findAll();
    res.json(tenants);
  } catch (error) {
    console.error('🔴 Erreur dans GET /tenants:', error);
    res.status(500).json({ message: error.message });
  }
});

// Créer un nouveau locataire
router.post('/', async (req, res) => {
  try {
    console.log('📝 Tentative de création d\'un locataire:', req.body);

    // Exclure explicitement l'ID des données reçues
    const { id, ...tenantData } = req.body;

    // Vérifier si l'email existe déjà
    const existingTenant = await Tenant.findOne({
      where: { mail: tenantData.mail }
    });

    if (existingTenant) {
      return res.status(400).json({
        message: 'Un locataire avec cet email existe déjà'
      });
    }

    const tenant = await Tenant.create(tenantData);
    
    // Log pour debug
    console.log('✅ Locataire créé avec ID:', tenant.id);
    res.status(201).json(tenant);

  } catch (error) {
    console.error('🔴 Erreur dans POST /tenants:', error);
    // ... reste du code de gestion d'erreur
  }
});

// Mettre à jour un locataire
router.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    console.log(`📝 Tentative de mise à jour du locataire ${id}:`, req.body);

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ message: 'Locataire non trouvé' });
    }

    await tenant.update(req.body);
    console.log('✅ Locataire mis à jour:', tenant.toJSON());
    
    res.json(tenant);
  } catch (error) {
    console.error('🔴 Erreur dans PUT /tenants/:id:', error);
    next(error);
  }
});

// Supprimer un locataire
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    console.log(`🗑️ Tentative de suppression du locataire ${id}`);

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({ message: 'Locataire non trouvé' });
    }

    await tenant.destroy();
    console.log('✅ Locataire supprimé');
    
    res.json({ message: 'Locataire supprimé avec succès' });
  } catch (error) {
    console.error('🔴 Erreur dans DELETE /tenants/:id:', error);
    next(error);
  }
});

// GET /api/tenants/:id - Récupérer un locataire par son ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching tenant with ID:', id);

    const tenant = await Tenant.findOne({
      where: { id: id },
      attributes: ['id', 'first_name', 'last_name', 'mail', 'phone']
    });

    if (!tenant) {
      return res.status(404).json({ 
        message: 'Locataire non trouvé' 
      });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération du locataire',
      error: error.message 
    });
  }
});


module.exports = router;