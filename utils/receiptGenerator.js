const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { SignPdf } = require('node-signpdf');
const signer = new SignPdf();

// Configuration du certificat
const CERTIFICATE_CONFIG = {
  p12Path: path.join(__dirname, '..', 'certificates', 'signature.p12'), // Chemin vers votre certificat P12
  certPassword: 'BBnn,,1122' // Mot de passe de votre certificat
};

async function signPDF(inputPath) {
  try {
    // Lire le PDF non signé
    const pdfBuffer = fs.readFileSync(inputPath);
    
    // Lire le certificat P12
    const p12Buffer = fs.readFileSync(CERTIFICATE_CONFIG.p12Path);

    // Signer le PDF
    const signedPdf = await signer.sign(pdfBuffer, p12Buffer, {
      passphrase: CERTIFICATE_CONFIG.certPassword,
      reason: 'Quittance de loyer',
      location: OWNER_INFO.city,
      signerName: OWNER_INFO.company,
      annotationAppearanceOptions: {
        signatureCoordinates: { left: 50, bottom: 100, right: 200, top: 150 },
        signatureDetails: [
          `Signé numériquement par: ${OWNER_INFO.company}`,
          `Date: ${new Date().toLocaleDateString('fr-FR')}`,
          'Raison: Quittance de loyer'
        ]
      }
    });

    // Écrire le PDF signé
    fs.writeFileSync(inputPath, signedPdf);
    console.log('✅ PDF successfully signed');

  } catch (error) {
    console.error('🔴 Error signing PDF:', error);
    throw error;
  }
}


function ensureDirectoryExistsSync(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    console.log('✅ Directory created:', directoryPath);
  }
}

// Configuration du bailleur
const OWNER_INFO = {
  name: 'PARDOUX Pierre',           // Remplacez par le nom réel du bailleur
  company: '',          // Remplacez par le nom de la société
  address: '30 avenue Esprit Brondino',   // Remplacez par l'adresse réelle
  postalCode: '13290',         // Remplacez par le code postal réel
  city: 'AIX EN PROVENCE'         // Remplacez par la ville réelle
};

async function generateReceipt(payment, rent) {
  return new Promise((resolve, reject) => {
    try {
      console.log('🟦 Starting receipt generation for payment:', payment.id);
      
      // Vérification des données requises
      if (!payment || !rent || !rent.tenant || !rent.room || !rent.room.property) {
        throw new Error('Données manquantes pour la génération de la quittance');
      }

      // Convertir tous les montants en nombres et calculs
      const totalAmount = parseFloat(rent.rent_value) || 0;
      const chargesAmount = parseFloat(rent.charges) || 0;
      const rentAmount = totalAmount - chargesAmount; // Loyer hors charges

      console.log('🟦 Amounts calculated:', {
        total: totalAmount,
        charges: chargesAmount,
        rentOnly: rentAmount
      });

      // Création des chemins avec vérification
      const storageDir = path.resolve(__dirname, '..', 'storage');
      const receiptsDir = path.join(storageDir, 'receipts');
      const date = new Date(payment.payment_date);
      const month = date.toLocaleDateString('fr-FR', { month: 'long' });
      const year = date.getFullYear();
      const yearDir = path.join(receiptsDir, year.toString());
      const monthDir = path.join(yearDir, month);

      // Création des répertoires si nécessaire
      [storageDir, receiptsDir, yearDir, monthDir].forEach(dir => {
        ensureDirectoryExistsSync(dir);
      });

      const filename = `quittance_${payment.id}.pdf`;
      const absoluteFilePath = path.join(monthDir, filename);
      const relativeFilePath = path.join('storage', 'receipts', year.toString(), month, filename)
        .split(path.sep)
        .join('/');

      console.log('🟦 Generating receipt at:', absoluteFilePath);

      const doc = new PDFDocument();
      const writeStream = fs.createWriteStream(absoluteFilePath);

      writeStream.on('error', (error) => {
        console.error('🔴 Write Stream Error:', error);
        reject(error);
      });

      doc.pipe(writeStream);

      // En-tête
      doc.fontSize(20)
         .text('QUITTANCE DE LOYER', { align: 'center' })
         .moveDown();

      // Mois et année
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
        `Je soussigné ${OWNER_INFO.company}, bailleur, donne quittance à ${rent.tenant.first_name} ${rent.tenant.last_name} ` +
        `pour la somme de ${totalAmount.toFixed(2)} euros, ` +
        `au titre du loyer et des charges du logement désigné ci-dessus ` +
        `pour la période du 1er au dernier jour du mois de ${month} ${year}.`
      )
      .moveDown()
      .moveDown();

      // Date et signature
      const currentDate = new Date().toLocaleDateString('fr-FR');
      doc.text(`Fait à ${OWNER_INFO.city}, le ${currentDate}`)
         .moveDown()
         .moveDown()
         .text('Signature du bailleur :')
         .moveDown()
         .moveDown();

      // Pied de page
      doc.fontSize(8)
         .text(
           'Cette quittance annule tous les reçus qui auraient pu être établis précédemment en cas de paiement partiel du montant ci-dessus.',
           { align: 'center' }
         );

      //  on attend la signature
      writeStream.on('finish', async () => {
        try {
          // Signer le PDF après sa génération
          await signPDF(absoluteFilePath);
          console.log('✅ Receipt generated and signed successfully:', relativeFilePath);
          resolve(relativeFilePath);
        } catch (signError) {
          console.error('🔴 Error during signing:', signError);
          reject(signError);
        }
      });

      writeStream.on('error', (error) => {
        console.error('🔴 Write Stream Error:', error);
        reject(error);
      });

      // Finalisation du document
      doc.end();

    } catch (error) {
      console.error('🔴 Error in generateReceipt:', error);
      reject(error);
    }
  });
}

module.exports = {
  generateReceipt,
  ensureDirectoryExistsSync
};