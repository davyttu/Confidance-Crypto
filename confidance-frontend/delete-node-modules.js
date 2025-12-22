// delete-node-modules.js - Script temporaire
const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
}

const nodeModulesPath = path.join(__dirname, 'node_modules');
console.log('Suppression de node_modules...');

try {
  deleteFolderRecursive(nodeModulesPath);
  console.log('✅ node_modules supprimé avec succès !');
} catch (error) {
  console.error('❌ Erreur:', error.message);
}
