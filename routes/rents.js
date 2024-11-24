const express = require('express');
const router = express.Router();
const { Sequelize, Op } = require('sequelize');
const {Rent} = require('../models/Rent');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const {sequelize} = require('../config');

// Créer une nouvelle location
router.post('/', async (req, res) => {
  let transaction = null;
  
  try {
    console.log('Données reçues:', req.body);

    // Validation préliminaire des données
    if (!req.body.id_tenant || !req.body.id_room || !req.body.date_entrance || !req.body.rent_value) {
      return res.status(400).json({
        message: 'Données manquantes',
        required: ['id_tenant', 'id_room', 'date_entrance', 'rent_value'],
        received: req.body
      });
    }

    // Formatage des données
    const rentData = {
      id_tenant: parseInt(req.body.id_tenant),
      id_room: parseInt(req.body.id_room),
      date_entrance: new Date(req.body.date_entrance).toISOString().split('T')[0],
      rent_value: parseFloat(req.body.rent_value),
      charges: parseFloat(req.body.charges || 0),
      end_date: req.body.end_date ? 
        new Date(req.body.end_date).toISOString().split('T')[0] : null
    };

    console.log('Données formatées:', rentData);

    // Démarrer la transaction
    transaction = await sequelize.transaction();

    // Vérification de l'existence du locataire et de la chambre
    const tenant = await Tenant.findByPk(rentData.id_tenant, { transaction });
    const room = await Room.findByPk(rentData.id_room, { transaction });

    if (!tenant || !room) {
      await transaction.rollback();
      return res.status(404).json({ 
        message: !tenant ? 'Locataire non trouvé' : 'Chambre non trouvée' 
      });
    }

    // Création simple de la location
    const rent = await Rent.create(rentData, { transaction });

    // Commit de la transaction
    await transaction.commit();

    // Récupération des données complètes
    const newRent = await Rent.findByPk(rent.id, {
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb']
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['first_name', 'last_name']
        }
      ]
    });

    res.status(201).json(newRent);

  } catch (error) {
    console.error('Erreur lors de la création:', error);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Erreur lors du rollback:', rollbackError);
      }
    }

    res.status(500).json({
      message: 'Erreur lors de la création de la location',
      error: error.message
    });
  }
});

// Récupérer toutes les locations
router.get('/', async (req, res) => {
  try {
    const rents = await Rent.findAll({
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb']
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['first_name', 'last_name']
        }
      ],
      order: [['date_entrance', 'DESC']]
    });

    res.json(rents);
  } catch (error) {
    console.error('Erreur récupération locations:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des locations',
      error: error.message 
    });
  }
});

// Récupérer une location par son ID
router.get('/:id', async (req, res) => {
  try {
    const rent = await Rent.findByPk(req.params.id, {
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb']
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['first_name', 'last_name']
        },
        {
          model: Payment,
          as: 'payments'
        }
      ]
    });

    if (!rent) {
      return res.status(404).json({ message: 'Location non trouvée' });
    }

    res.json(rent);
  } catch (error) {
    console.error('Erreur récupération location:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération de la location',
      error: error.message 
    });
  }
});

// Mettre à jour une location
router.put('/:id', async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const rentId = req.params.id;
    
    // 1. Récupérer l'ancienne location
    const oldRent = await Rent.findByPk(rentId);
    if (!oldRent) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Location non trouvée' });
    }

    // 2. Vérifier l'existence du locataire et de la chambre si modifiés
    if (req.body.id_tenant) {
      const tenant = await Tenant.findByPk(req.body.id_tenant, { transaction });
      if (!tenant) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Locataire non trouvé' });
      }
    }

    if (req.body.id_room) {
      const room = await Room.findByPk(req.body.id_room, { transaction });
      if (!room) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Chambre non trouvée' });
      }
    }

    // 3. Mise à jour de la location
    const updatedData = {
      id_tenant: req.body.id_tenant || oldRent.id_tenant,
      id_room: req.body.id_room || oldRent.id_room,
      date_entrance: req.body.date_entrance || oldRent.date_entrance,
      end_date: req.body.end_date || oldRent.end_date,
      rent_value: req.body.rent_value || oldRent.rent_value,
      charges: req.body.charges || oldRent.charges
    };

    await oldRent.update(updatedData, { transaction });

    await transaction.commit();

    // 4. Récupérer la location mise à jour avec ses relations
    const updatedRent = await Rent.findByPk(rentId, {
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb']
        },
        {
          model: Tenant,
          as: 'tenant',
          attributes: ['first_name', 'last_name']
        },
        {
          model: Payment,
          as: 'payments'
        }
      ]
    });

    res.json(updatedRent);

  } catch (error) {
    await transaction.rollback();
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour de la location',
      error: error.message
    });
  }
});

// Supprimer une location
router.delete('/:id', async (req, res) => {
  try {
    const rent = await Rent.findByPk(req.params.id);
    
    if (!rent) {
      return res.status(404).json({ message: 'Location non trouvée' });
    }

    await rent.destroy();
    res.json({ message: 'Location supprimée avec succès' });

  } catch (error) {
    console.error('Erreur suppression location:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la suppression de la location',
      error: error.message 
    });
  }
});

module.exports = router;