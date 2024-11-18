const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const qr = require('qrcode');
const { SignPdf } = require('node-signpdf');
const fs = require('fs');
const path = require('path');
const storageService = require('../services/storageService');

const OWNER_INFO = {
  name: 'PARDOUX Pierre',
  company: '',
  address: '30 avenue Esprit Brondino',
  postalCode: '13290',
  city: 'AIX EN PROVENCE',
  siret: '123456789'
};

class ReceiptGenerator {
  constructor() {
    this.signaturePath = path.join(__dirname, '../config/signature.p12');
    this.signaturePassword = process.env.SIGNATURE_PASSWORD;
    this.verificationUrl = process.env.VERIFICATION_URL;
    this.hashSecret = process.env.HASH_SECRET;
  }

  createDocumentHash(payment, rent, date) {
    return crypto
      .createHash('sha256')
      .update(`${payment.id}-${rent.id}-${date}-${this.hashSecret}`)
      .digest('hex');
  }

  async generateVerificationQR(hash) {
    return await qr.toDataURL(`${this.verificationUrl}/verify/${hash}`);
  }

  async signPDF(pdfBuffer) {
    const signer = new SignPdf();
    return await signer.signPDF(pdfBuffer, {
      certificatePath: this.signaturePath,
      password: this.signaturePassword
    });
  }

  async generateReceipt(payment, rent) {
    try {
      let chunks = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Quittance de loyer - ${rent.tenant.first_name} ${rent.tenant.last_name}`,
          Author: OWNER_INFO.name,
          Subject: 'Quittance de loyer',
          Keywords: 'quittance, loyer, location'
        }
      });

      // Collecter les chunks du PDF
      doc.on('data', chunk => chunks.push(chunk));

      // Format des montants
      const totalAmount = parseFloat(rent.rent_value) || 0;
      const chargesAmount = parseFloat(rent.charges) || 0;
      const rentAmount = totalAmount - chargesAmount;

      // Date de la quittance
      const paymentDate = new Date(payment.payment_date);
      const month = paymentDate.toLocaleDateString('fr-FR', { month: 'long' });
      const year = paymentDate.getFullYear();

      // Créer le hash et QR code
      const documentHash = this.createDocumentHash(payment, rent, paymentDate);
      const qrCodeDataUrl = await this.generateVerificationQR(documentHash);

      // En-tête
      doc.fontSize(20)
         .text('QUITTANCE DE LOYER', { align: 'center' })
         .moveDown();

      // Période
      doc.fontSize(14)
         .text(`${month} ${year}`, { align: 'center' })
         .moveDown()
         .moveDown();

      // Informations du bailleur
      doc.fontSize(12)
         .text(OWNER_INFO.name, { underline: true })
         .moveDown()
         .text(OWNER_INFO.company)
         .text(OWNER_INFO.address)
         .text(`${OWNER_INFO.postalCode} ${OWNER_INFO.city}`)
         .text(`SIRET: ${OWNER_INFO.siret}`)
         .moveDown()
         .moveDown();

      // Informations du locataire
      doc.text('LOCATAIRE :', { underline: true })
         .moveDown()
         .text(`${rent.tenant.first_name} ${rent.tenant.last_name}`)
         .text(`${rent.room.property.name} - Chambre ${rent.room.room_nb}`)
         .text(`${rent.room.property.address}`)
         .text(`${rent.room.property.postalcode} ${rent.room.property.city}`)
         .moveDown()
         .moveDown();

      // Détails du paiement
      doc.text('DÉTAILS DU PAIEMENT', { underline: true })
         .moveDown()
         .text(`Loyer : ${rentAmount.toFixed(2)} €`)
         .text(`Charges : ${chargesAmount.toFixed(2)} €`)
         .text(`Total : ${totalAmount.toFixed(2)} €`)
         .moveDown()
         .moveDown();

      // Texte de quittance
      doc.text(
        `Je soussigné ${OWNER_INFO.name}, propriétaire du logement désigné ci-dessus, ` +
        `déclare avoir reçu de ${rent.tenant.first_name} ${rent.tenant.last_name} ` +
        `la somme de ${totalAmount.toFixed(2)} euros ` +
        `(loyer : ${rentAmount.toFixed(2)} euros, charges : ${chargesAmount.toFixed(2)} euros) ` +
        `au titre du loyer et des charges ` +
        `pour la période du 1er au dernier jour du mois de ${month} ${year}.`
      )
      .moveDown()
      .moveDown();

      // Date et signature électronique
      const currentDate = new Date().toLocaleDateString('fr-FR');
      doc.text(`Fait à ${OWNER_INFO.city}, le ${currentDate}`)
         .moveDown()
         .moveDown()
         .text('Signature électronique sécurisée :')
         .moveDown();

      // QR Code et informations de vérification
      doc.image(qrCodeDataUrl, {
        fit: [100, 100],
        align: 'center'
      });

      doc.fontSize(8)
         .moveDown()
         .text('Pour vérifier l\'authenticité de ce document, scannez le QR code ci-dessus', { align: 'center' })
         .text(`ou visitez ${this.verificationUrl}/verify/${documentHash}`, { align: 'center' })
         .text(`ID de vérification: ${documentHash.substring(0, 8)}`, { align: 'center' })
         .text(`Document signé électroniquement le ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });

      // Finaliser le document
      doc.end();

      // Attendre la génération complète
      const pdfBuffer = Buffer.concat(chunks);

      // Signer le PDF
      const signedPdf = await this.signPDF(pdfBuffer);

      // Upload vers Supabase Storage
      const storagePath = storageService.getReceiptPath(paymentDate, rent.tenant.id);
      const filename = `quittance_${payment.id}_${month}_${year}.pdf`;

      const storageFile = await storageService.uploadFile({
        originalname: filename,
        buffer: signedPdf,
        mimetype: 'application/pdf'
      }, storageService.buckets.receipts, storagePath);

      return {
        path: storageFile.path,
        url: storageFile.url,
        filename,
        verificationHash: documentHash,
        signedAt: new Date()
      };

    } catch (error) {
      console.error('Erreur génération quittance:', error);
      throw error;
    }
  }
}

module.exports = new ReceiptGenerator();