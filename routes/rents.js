const express = require('express');
const router = express.Router();
const { Sequelize, Op } = require('sequelize');
const {Rent} = require('../models/Rent');
const Property = require('../models/Property');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const {sequelize} = require('../config');

// Fonction utilitaire pour réinitialiser la séquence si nécessaire
async function resetRentSequence(transaction) {
  try {
    await sequelize.query(
      `SELECT setval(pg_get_serial_sequence('rents', 'id'), (SELECT MAX(id) FROM rents));`,
      { transaction }
    );
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la séquence:', error);
    throw error;
  }
}

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

    // Démarrer la transaction avec un niveau d'isolation approprié
    transaction = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });

    // Réinitialiser la séquence avant l'insertion
    await resetRentSequence(transaction);

    // Vérification de l'existence du locataire et de la chambre
    const [tenant, room] = await Promise.all([
      Tenant.findByPk(rentData.id_tenant, { transaction }),
      Room.findByPk(rentData.id_room, { transaction })
    ]);

    if (!tenant || !room) {
      throw new Error(!tenant ? 'Locataire non trouvé' : 'Chambre non trouvée');
    }

    // Création de la location avec gestion des erreurs de séquence
    let rent;
    try {
      rent = await Rent.create(rentData, { 
        transaction,
        retry: {
          max: 0
        }
      });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        await resetRentSequence(transaction);
        rent = await Rent.create(rentData, { transaction });
      } else {
        throw error;
      }
    }

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

    if (error.message.includes('trouvé')) {
      return res.status(404).json({
        message: error.message
      });
    }

    res.status(500).json({
      message: 'Erreur lors de la création de la location',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        name: error.name,
        sql: error.sql,
        parameters: error.parameters
      } : error.message
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
          attributes: ['room_nb'],
          include: [{
            model: Property,
            as: 'property',
            attributes: ['name', 'address']
          }]
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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
});

// Récupérer une location par ID
router.get('/:id', async (req, res) => {
  try {
    const rent = await Rent.findByPk(req.params.id, {
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb'],
          include: [{
            model: Property,
            as: 'property',
            attributes: ['name', 'address']
          }]
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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
});

// Mettre à jour une location
router.put('/:id', async (req, res) => {
  let transaction = null;

  try {
    transaction = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });

    // Vérifier l'existence de la location
    const rent = await Rent.findByPk(req.params.id, { transaction });
    if (!rent) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Location non trouvée' });
    }

    // Vérifier l'existence du locataire et de la chambre si modifiés
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

    // Préparation des données de mise à jour
    const updateData = {
      id_tenant: req.body.id_tenant || rent.id_tenant,
      id_room: req.body.id_room || rent.id_room,
      date_entrance: req.body.date_entrance ? 
        new Date(req.body.date_entrance).toISOString().split('T')[0] : 
        rent.date_entrance,
      end_date: req.body.end_date ? 
        new Date(req.body.end_date).toISOString().split('T')[0] : 
        rent.end_date,
      rent_value: req.body.rent_value || rent.rent_value,
      charges: req.body.charges !== undefined ? req.body.charges : rent.charges
    };

    // Mise à jour de la location
    await rent.update(updateData, { transaction });

    await transaction.commit();

    // Récupération des données mises à jour
    const updatedRent = await Rent.findByPk(req.params.id, {
      include: [
        {
          model: Room,
          as: 'room',
          attributes: ['room_nb'],
          include: [{
            model: Property,
            as: 'property',
            attributes: ['name', 'address']
          }]
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
    console.error('Erreur lors de la mise à jour:', error);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Erreur lors du rollback:', rollbackError);
      }
    }

    res.status(500).json({
      message: 'Erreur lors de la mise à jour de la location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
});

// Supprimer une location
router.delete('/:id', async (req, res) => {
  let transaction = null;

  try {
    transaction = await sequelize.transaction();

    const rent = await Rent.findByPk(req.params.id, { transaction });
    
    if (!rent) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Location non trouvée' });
    }

    await rent.destroy({ transaction });
    await transaction.commit();
    
    res.json({ message: 'Location supprimée avec succès' });

  } catch (error) {
    console.error('Erreur suppression location:', error);
    
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Erreur lors du rollback:', rollbackError);
      }
    }

    res.status(500).json({ 
      message: 'Erreur lors de la suppression de la location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
});

module.exports = router;