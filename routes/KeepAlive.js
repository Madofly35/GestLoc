// Backend (Express)
const express = require('express');
const router = express.Router();

// Route légère pour le ping
router.get('/ping', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;

// Frontend (React)
import { useEffect } from 'react';

const useKeepAlive = (url, interval = 30000) => {
  useEffect(() => {
    const pingServer = async () => {
      try {
        const response = await fetch(`${url}/ping`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (!response.ok) {
          console.warn('Ping failed:', response.status);
        }
      } catch (error) {
        console.warn('Ping error:', error);
      }
    };

    // Premier ping immédiat
    pingServer();
    
    // Mise en place de l'intervalle
    const intervalId = setInterval(pingServer, interval);

    // Nettoyage à la désinstallation du composant
    return () => clearInterval(intervalId);
  }, [url, interval]);
};

export default useKeepAlive;
