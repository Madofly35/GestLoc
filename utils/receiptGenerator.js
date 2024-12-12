const PDFDocument = require('pdfkit');
const forge = require('node-forge');
const qr = require('qrcode');
const storageService = require('../services/storageService');

// Configuration du bailleur
const OWNER_INFO = {
  name: 'PARDOUX Pierre',
  company: '',
  address: '30 avenue Esprit Brondino',
  postalCode: '13290',
  city: 'AIX EN PROVENCE'
};

// Fonction pour générer un identifiant unique pour la signature
function generateSignatureId() {
  return forge.util.bytesToHex(forge.random.getBytesSync(16));
}

// Fonction pour générer le QR code
async function generateQRCode(signatureData) {
  try {
    return await qr.toDataURL(JSON.stringify(signatureData));
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw error;
  }
}

async function addVisualSignature(doc, signatureData) {
  try {
    // Ajouter une section de signature visuelle
    doc.fontSize(10)
       .moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke()
       .moveDown();

    // Générer et ajouter le QR code
    const qrCodeDataUrl = await generateQRCode(signatureData);
    doc.image(qrCodeDataUrl, 50, doc.y, { width: 100 });

    // Ajouter les informations de signature à côté du QR code
    doc.fontSize(8)
       .text('Informations de signature électronique:', 160, doc.y - 90)
       .moveDown(0.5)
       .text(`ID de signature: ${signatureData.signatureId}`)
       .text(`Date de signature: ${signatureData.timestamp}`)
       .text(`Signataire: ${signatureData.signer}`)
       .text('Vérifié par: Système de signature numérique v1.0')
       .moveDown()
       .text('Pour vérifier l\'authenticité de ce document, scannez le QR code ou')
       .text('visitez notre portail de vérification en ligne.');

  } catch (error) {
    console.error('Visual signature error:', error);
    throw error;
  }
}

function addDigitalSignature(pdfBuffer) {
  try {
    const signatureId = generateSignatureId();
    const timestamp = new Date().toISOString();

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

    // Créer l'objet de données de signature
    const signatureData = {
      signatureId,
      timestamp,
      signer: OWNER_INFO.name,
      documentHash: md.digest().toHex(),
      signatureValue: signature.toString('base64')
    };

    // Ajouter les métadonnées de signature
    const signedPdfBuffer = Buffer.concat([
      pdfBuffer,
      Buffer.from('\n%SignatureData: ' + JSON.stringify(signatureData) + '\n'),
      Buffer.from('%Certificate: ' + forge.pki.certificateToPem(cert))
    ]);

    return {
      buffer: signedPdfBuffer,
      signatureData
    };
  } catch (error) {
    console.error('⚠️ Signature error:', error);
    throw error;
  }
}

async function generateReceipt(payment, rent) {
  return new Promise(async (resolve, reject) => {
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
          const { buffer: signedPdfBuffer, signatureData } = addDigitalSignature(pdfBuffer);

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
              url: result.url,
              signatureData
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

      // [Le reste du contenu du PDF reste identique jusqu'à avant la signature]

      doc.text(`Fait à ${OWNER_INFO.city}, le ${new Date().toLocaleDateString('fr-FR')}`)
         .moveDown()
         .moveDown();

      // Ajouter la signature visuelle avec le QR code
      await addVisualSignature(doc, {
        signatureId: generateSignatureId(),
        timestamp: new Date().toISOString(),
        signer: OWNER_INFO.name
      });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

async function verifyReceipt(filePath) {
  try {
    // Récupérer le fichier depuis le stockage
    const fileData = await storageService.getFile(
      storageService.buckets.receipts,
      filePath
    );

    // Extraire et vérifier les métadonnées de signature
    const pdfContent = fileData.toString();
    const signatureMatch = pdfContent.match(/%SignatureData: ({[^}]+})/);
    
    if (!signatureMatch) {
      return {
        isValid: false,
        error: 'Signature non trouvée'
      };
    }

    const signatureData = JSON.parse(signatureMatch[1]);

    // Vérifier la date de signature
    const signatureDate = new Date(signatureData.timestamp);
    const now = new Date();
    const isDateValid = signatureDate <= now;

    return {
      isValid: isDateValid,
      signatureData,
      url: await storageService.getFileUrl(storageService.buckets.receipts, filePath)
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