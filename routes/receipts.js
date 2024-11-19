const express = require('express');
const router = express.Router();
const { Receipt, Payment, Rent, Tenant, Room, Property } = require('../models/associations');
const { generateReceipt } = require('../utils/receiptGenerator');
const storageService = require('../services/storageService');

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

    const formattedPayments = await Promise.all(payments.map(async payment => {
      if (!payment.rent?.tenant || !payment.rent?.room?.property) {
        console.warn('⚠️ Missing data for payment:', payment.id);
        return null;
      }

      const rent = payment.rent;
      const paymentDate = new Date(payment.payment_date);
      const fileData = {
        id: payment.id,
        amount: payment.amount,
        payment_date: payment.payment_date,
        month: paymentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        receipt_generated: !!payment.paymentReceipt,
        tenant_name: `${rent.tenant.first_name} ${rent.tenant.last_name}`,
        property_name: rent.room.property.name,
        property_address: rent.room.property.address,
        room_number: rent.room.room_nb,
        rent_period: {
          start: rent.date_entrance,
          end: rent.end_date || 'En cours'
        }
      };

      // Ajouter l'URL Supabase si la quittance existe
      if (payment.paymentReceipt) {
        try {
          const filePath = `tenant_${tenantId}/${paymentDate.getFullYear()}/${paymentDate.toLocaleDateString('fr-FR', { month: 'long' })}/receipt_${payment.id}.pdf`;
          fileData.receipt_url = await storageService.getFileUrl(storageService.buckets.receipts, filePath);
        } catch (error) {
          console.warn('⚠️ Error getting receipt URL:', error);
        }
      }

      return fileData;
    }));

    const validPayments = formattedPayments.filter(Boolean);
    console.log('✅ Formatted payments:', validPayments);
    res.json(validPayments);

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

    if (!payment.rent?.tenant || !payment.rent?.room?.property) {
      return res.status(400).json({ message: "Données incomplètes pour générer la quittance" });
    }

    try {
      console.log('🟦 Payment data:', {
        id: payment.id,
        amount: payment.amount,
        tenant: payment.rent.tenant.first_name + ' ' + payment.rent.tenant.last_name
      });

      let receipt = payment.paymentReceipt;
      let fileUrl;

      if (!receipt) {
        console.log('🟦 No receipt found, generating new one...');
        const result = await generateReceipt(payment, payment.rent);
        
        receipt = await Receipt.create({
          payment_id: payment.id,
          storage_path: result.path,
          storage_url: result.url,
          generated_at: new Date()
        });

        fileUrl = result.url;
        console.log('✅ New receipt created:', receipt.id);
      } else {
        try {
          fileUrl = await storageService.getFileUrl(
            storageService.buckets.receipts, 
            receipt.storage_path
          );
        } catch (error) {
          console.log('🟦 Error getting existing receipt, regenerating...');
          const result = await generateReceipt(payment, payment.rent);
          await receipt.update({ 
            storage_path: result.path,
            storage_url: result.url 
          });
          fileUrl = result.url;
        }
      }

      // Mettre à jour la date de téléchargement
      await receipt.update({ downloaded_at: new Date() });

      res.json({ url: fileUrl });

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