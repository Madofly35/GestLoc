// backend/routes/verification.js
const express = require('express');
const router = express.Router();
const { verifyReceipt } = require('../utils/receiptGenerator');

router.get('/verify/:hash', async (req, res) => {
  try {
    const receipt = await verifyReceipt(req.params.hash);
    if (!receipt) {
      return res.status(404).json({
        status: 'error',
        message: 'Document non trouvé'
      });
    }

    res.json({
      status: 'success',
      data: {
        isValid: true,
        documentInfo: {
          type: 'Quittance de loyer',
          date: receipt.generated_at,
          tenant: `${receipt.Payment.Rent.Tenant.first_name} ${receipt.Payment.Rent.Tenant.last_name}`,
          property: receipt.Payment.Rent.Room.Property.name,
          amount: receipt.Payment.amount
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
