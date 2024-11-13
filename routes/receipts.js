const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { Receipt, Payment, Rent, Tenant, Room, Property } = require('../models/associations');
const { generateReceipt } = require('../utils/receiptGenerator');

// GET /api/tenants/:tenantId/receipts
router.get('/tenants/:tenantId/receipts', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.log('🟦 Fetching receipts for tenant:', tenantId);
    
    // Récupérer toutes les locations du locataire
    const rents = await Rent.findAll({
      where: { id_tenant: tenantId },
      include: [
        {
          model: Room,
          as: 'room',
          include: [{
            model: Property,
            as: 'property'
          }]
        }
      ],
      order: [['date_entrance', 'DESC']]
    });

    if (!rents || rents.length === 0) {
      console.log('❌ No rents found for tenant:', tenantId);
      return res.status(404).json({ message: 'Aucune location trouvée pour ce locataire' });
    }

    console.log('✅ Found rents:', rents.map(rent => ({
      id: rent.id,
      entrance: rent.date_entrance,
      end: rent.end_date
    })));

    // Récupérer tous les paiements associés à ces locations
    const rentIds = rents.map(rent => rent.id);
    const payments = await Payment.findAll({
      where: {
        rent_id: rentIds,
        status: 'paid'
      },
      include: [
        {
          model: Receipt,
          as: 'paymentReceipt',
          required: false
        },
        {
          model: Rent,
          as: 'rent',
          where: { id_tenant: tenantId },
          include: [
            {
              model: Tenant,
              as: 'tenant'
            },
            {
              model: Room,
              as: 'room',
              include: [{
                model: Property,
                as: 'property'
              }]
            }
          ]
        }
      ],
      order: [['payment_date', 'DESC']]
    });

    console.log('✅ Found payments:', payments.map(payment => ({
      id: payment.id,
      date: payment.payment_date,
      tenant: payment.rent?.tenant?.first_name + ' ' + payment.rent?.tenant?.last_name,
      amount: payment.amount
    })));

    const formattedPayments = payments.map(payment => {
      // Vérification de l'existence des données nécessaires
      if (!payment.rent?.tenant || !payment.rent?.room?.property) {
        console.warn('⚠️ Missing data for payment:', payment.id);
        return null;
      }

      const rent = payment.rent;
      const paymentDate = new Date(payment.payment_date);
      
      return {
        id: payment.id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        month: paymentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        receipt_generated: !!payment.paymentReceipt,
        tenant_name: `${rent.tenant.first_name} ${rent.tenant.last_name}`,
        property_name: rent.room.property.name,
        property_address: rent.room.property.address,
        room_number: rent.room.room_nb,
        // Ajouter des informations sur la location
        rent_period: {
          start: rent.date_entrance,
          end: rent.end_date || 'En cours'
        }
      };
    }).filter(Boolean); // Filtrer les paiements avec données manquantes

    console.log('✅ Formatted payments:', formattedPayments);
    res.json(formattedPayments);

  } catch (error) {
    console.error('❌ Error fetching receipts:', error);
    res.status(500).json({ 
      message: 'Erreur serveur',
      error: error.message 
    });
  }
});


// GET /api/receipts/:paymentId/download
router.get('/receipts/:paymentId/download', async (req, res) => {
  try {
    const { paymentId } = req.params;
    console.log('🟦 Downloading receipt for payment:', paymentId);
    
    const payment = await Payment.findOne({
      where: { id: paymentId },
      include: [
        {
          model: Receipt,
          as: 'paymentReceipt',
          required: false
        },
        {
          model: Rent,
          as: 'rent',
          include: [
            {
              model: Tenant,
              as: 'tenant'
            },
            {
              model: Room,
              as: 'room',
              include: [{
                model: Property,
                as: 'property'
              }]
            }
          ]
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ message: "Paiement non trouvé" });
    }

    if (!payment.rent || !payment.rent.tenant || !payment.rent.room || !payment.rent.room.property) {
      return res.status(400).json({ message: "Données incomplètes pour générer la quittance" });
    }

    try {
      console.log('🟦 Payment data:', {
        id: payment.id,
        amount: payment.amount,
        tenant: payment.rent.tenant.first_name + ' ' + payment.rent.tenant.last_name
      });

      let receipt = payment.paymentReceipt;
      let filePath;

      // Toujours utiliser generateReceipt du module receiptGenerator
      if (!receipt) {
        console.log('🟦 No receipt found, generating new one with receiptGenerator...');
        filePath = await generateReceipt(payment, payment.rent);
        
        receipt = await Receipt.create({
          payment_id: payment.id,
          file_path: filePath,
          generated_at: new Date()
        });

        console.log('✅ New receipt created:', receipt.id);
      } else {
        filePath = receipt.file_path;
      }

      // Vérifier si le fichier existe physiquement
      const absoluteFilePath = path.resolve(__dirname, '..', filePath);
      if (!fs.existsSync(absoluteFilePath)) {
        console.log('🟦 Physical file not found, regenerating with receiptGenerator...');
        filePath = await generateReceipt(payment, payment.rent);
        await receipt.update({ file_path: filePath });
        
        const newAbsoluteFilePath = path.resolve(__dirname, '..', filePath);
        if (!fs.existsSync(newAbsoluteFilePath)) {
          throw new Error('Impossible de générer la quittance');
        }
      }

      // Mettre à jour la date de téléchargement
      await receipt.update({ downloaded_at: new Date() });

      // Créer le nom du fichier pour le téléchargement
      const date = new Date(payment.payment_date);
      const month = date.toLocaleDateString('fr-FR', { month: 'long' });
      const year = date.getFullYear();
      const fileName = `quittance_${month}_${year}_${payment.id}.pdf`;

      console.log('🟦 Sending file:', {
        path: absoluteFilePath,
        filename: fileName
      });

      // Envoyer le fichier
      res.download(absoluteFilePath, fileName, (err) => {
        if (err) {
          console.error('🔴 Error sending file:', err);
          throw new Error('Erreur lors de l\'envoi du fichier');
        }
      });

    } catch (genError) {
      console.error('🔴 Error generating/sending receipt:', genError);
      res.status(500).json({ 
        message: 'Erreur lors de la génération/envoi de la quittance',
        error: genError.message 
      });
    }

  } catch (error) {
    console.error('🔴 Error in download route:', error);
    res.status(500).json({ 
      message: 'Erreur lors du téléchargement de la quittance',
      error: error.message 
    });
  }
});


module.exports = router;