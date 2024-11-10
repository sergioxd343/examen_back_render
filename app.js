// app.js
const express = require('express');
const app = express();
const apiRoutes = require('./routes/api');

app.use(express.json());

// Configuración de rutas
app.use('/api', apiRoutes);

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
