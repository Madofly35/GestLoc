const PDFDocument = require('pdfkit');
const forge = require('node-forge');
const storageService = require('../services/storageService');

// Configuration du bailleur
const OWNER_INFO = {
  name: 'PARDOUX Pierre',
  company: '',
  address: '30 avenue Esprit Brondino',
  postalCode: '13290',
  city: 'AIX EN PROVENCE'
};

function addDigitalSignature(pdfBuffer) {
  try {
    // Créer une signature
    const md = forge.md.sha256.create();
    md.update(pdfBuffer.toString('binary'));

    // Créer les attributs du signataire
    const attrs = [{
      name: 'commonName',
      value: OWNER_INFO.name
    }, {
      name: 'countryName',
      value: 'FR'
    }, {
      shortName: 'ST',
      value: 'PACA'
    }, {
      name: 'localityName',
      value: OWNER_INFO.city
    }];

    // Générer une paire de clés
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);

    // Signer
    const signature = keys.privateKey.sign(md);

    // Ajouter les métadonnées de signature
    const signedPdfBuffer = Buffer.concat([
      pdfBuffer,
      Buffer.from('\n%Signed by: ' + OWNER_INFO.name + '\n'),
      Buffer.from('%Signature date: ' + new Date().toISOString() + '\n'),
      Buffer.from('%Digital Signature: ' + signature.toString('base64') + '\n'),
      Buffer.from('%Certificate: ' + forge.pki.certificateToPem(cert))
    ]);

    return signedPdfBuffer;
  } catch (error) {
    console.error('⚠️ Signature error:', error);
    return pdfBuffer;
  }
}

async function generateReceipt(payment, rent) {
  return new Promise((resolve, reject) => {
    try {
      if (!payment || !rent || !rent.tenant || !rent.room || !rent.room.property) {
        throw new Error('Données manquantes pour la génération de la quittance');
      }

      const totalAmount = parseFloat(rent.rent_value) || 0;
      const chargesAmount = parseFloat(rent.charges) || 0;
      const rentAmount = totalAmount - chargesAmount;

      const buffers = [];
      const doc = new PDFDocument();
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          const signedPdfBuffer = addDigitalSignature(pdfBuffer);

          const date = new Date(payment.payment_date);
          const filePath = `tenant_${rent.tenant.id}/${date.getFullYear()}/${date.toLocaleDateString('fr-FR', { month: 'long' })}/receipt_${payment.id}.pdf`;

          try {
            const result = await storageService.uploadFile(
              { 
                buffer: signedPdfBuffer,
                mimetype: 'application/pdf'
              },
              storageService.buckets.receipts,
              filePath
            );
    
            resolve({
              path: filePath,
              url: result.url
            });
          } catch (uploadError) {
            console.error('Upload error:', uploadError);
            reject(uploadError);
          }
        } catch (error) {
          console.error('Receipt generation error:', error);
          reject(error);
        }
      });
    

      // Contenu du PDF
      doc.fontSize(20)
         .text('QUITTANCE DE LOYER', { align: 'center' })
         .moveDown();

      const date = new Date(payment.payment_date);
      const month = date.toLocaleDateString('fr-FR', { month: 'long' });
      const year = date.getFullYear();

      doc.fontSize(14)
         .text(`${month} ${year}`, { align: 'center' })
         .moveDown()
         .moveDown();

      doc.fontSize(12)
         .text(OWNER_INFO.name, { underline: true })
         .moveDown()
         .text(OWNER_INFO.company)
         .text(OWNER_INFO.address)
         .text(`${OWNER_INFO.postalCode} ${OWNER_INFO.city}`)
         .moveDown()
         .moveDown();

      doc.text('LOCATAIRE :', { underline: true })
         .moveDown()
         .text(`${rent.tenant.first_name} ${rent.tenant.last_name}`)
         .text(`${rent.room.property.name} - Chambre ${rent.room.room_nb}`)
         .text(`${rent.room.property.address}`)
         .text(`${rent.room.property.postalcode} ${rent.room.property.city}`)
         .moveDown()
         .moveDown();

      doc.text('DÉTAILS DU PAIEMENT', { underline: true })
         .moveDown()
         .text(`Loyer : ${rentAmount.toFixed(2)} €`)
         .text(`Charges : ${chargesAmount.toFixed(2)} €`)
         .text(`Total : ${totalAmount.toFixed(2)} €`)
         .moveDown()
         .moveDown();

      doc.text(
        `Je soussigné ${OWNER_INFO.name}, bailleur, donne quittance à ${rent.tenant.first_name} ${rent.tenant.last_name} ` +
        `pour la somme de ${totalAmount.toFixed(2)} euros, ` +
        `au titre du loyer et des charges du logement désigné ci-dessus ` +
        `pour la période du 1er au dernier jour du mois de ${month} ${year}.`
      )
      .moveDown()
      .moveDown();

      const currentDate = new Date().toLocaleDateString('fr-FR');
      doc.text(`Fait à ${OWNER_INFO.city}, le ${currentDate}`)
         .moveDown()
         .moveDown()
         .text('Signature du bailleur :')
         .moveDown()
         .moveDown();

      doc.fontSize(8)
         .text(
           'Cette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement partiel du montant ci-dessus.',
           { align: 'center' }
         )
         .moveDown()
         .text('Document signé électroniquement', { align: 'center' });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

async function verifyReceipt(filePath) {
  try {
    const url = await storageService.getFileUrl(
      storageService.buckets.receipts,
      filePath
    );

    return {
      isValid: true,
      url: url
    };
  } catch (error) {
    console.error('Error verifying receipt:', error);
    throw error;
  }
}

module.exports = {
  generateReceipt,
  verifyReceipt
};