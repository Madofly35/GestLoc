const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Créer le dossier certificates s'il n'existe pas
const certDir = path.join(__dirname, '..', 'certificates');
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir);
}

// Générer un certificat auto-signé avec OpenSSL
const certPath = path.join(certDir, 'signature');
const config = {
  country: 'FR',
  state: 'Rhone',
  locality: 'AIX EN PROVENCE',
  organization: 'Pierre PARDOUX',
  commonName: 'Pierre PARDOUX Signing Certificate',
  emailAddress: 'p.pardoux@gmail.com.com'
};

try {
  // Générer la clé privée
  execSync(`openssl genrsa -out ${certPath}.key 2048`);

  // Générer la demande de certificat
  execSync(`openssl req -new -key ${certPath}.key -out ${certPath}.csr \
    -subj "/C=${config.country}/ST=${config.state}/L=${config.locality}/O=${config.organization}/CN=${config.commonName}/emailAddress=${config.emailAddress}"`);

  // Générer le certificat auto-signé
  execSync(`openssl x509 -req -days 365 -in ${certPath}.csr -signkey ${certPath}.key -out ${certPath}.crt`);

  // Convertir en format PKCS#12
  execSync(`openssl pkcs12 -export -out ${certPath}.p12 \
    -inkey ${certPath}.key \
    -in ${certPath}.crt \
    -passout pass:${certPassword}`);

  console.log('✅ Certificate generated successfully');

} catch (error) {
  console.error('🔴 Error generating certificate:', error);
}
