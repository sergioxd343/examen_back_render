// routes/api.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Endpoint: Buscar productos por palabra clave
router.get('/items', async (req, res) => {
  const { q } = req.query;
  try {
    const result = await pool.query(
      `SELECT * FROM products WHERE title ILIKE $1 OR description ILIKE $1`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar productos' });
  }
});

// Endpoint: Obtener detalles de un producto por ID
router.get('/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const product = await pool.query(`SELECT * FROM products WHERE id = $1`, [id]);
    const images = await pool.query(`SELECT image_url FROM product_images WHERE product_id = $1`, [id]);
    res.json({ ...product.rows[0], images: images.rows.map(img => img.image_url) });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
});

// Endpoint: Registrar una compra
router.post('/addSale', async (req, res) => {
  const { productId, quantity } = req.body;
  try {
    const product = await pool.query(`SELECT price, discount_percentage FROM products WHERE id = $1`, [productId]);
    if (product.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    const price = product.rows[0].price;
    const discount = product.rows[0].discount_percentage;
    const totalPrice = quantity * (price - (price * (discount / 100)));

    await pool.query(
      `INSERT INTO sales (product_id, quantity, total_price) VALUES ($1, $2, $3)`,
      [productId, quantity, totalPrice]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar la compra' });
  }
});

// Endpoint: Obtener todas las ventas
router.get('/sales', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM bazar.sales');
      res.json(result.rows);
    } catch (error) {
      console.error('Error en la consulta a la base de datos:', error);
      res.status(500).json({
        error: 'Error al obtener las ventas',
        details: error.message
      });
    }
  });
// Endpoint: Agregar múltiples productos con sus imágenes
router.post('/items/bulk', async (req, res) => {
    const products = req.body; // Esperamos un arreglo de productos
  
    try {
      // Iniciar una transacción para asegurar que todas las inserciones se completen correctamente
      const client = await pool.connect();
      await client.query('BEGIN');
  
      // Crear una lista para almacenar las consultas de inserción de productos
      const productPromises = products.map(async (product) => {
        const {
          title,
          description,
          price,
          discount_percentage,
          rating,
          stock,
          brand,
          category,
          thumbnail,
          images
        } = product;
  
        // Insertar el producto en la tabla de productos
        const result = await client.query(
          `INSERT INTO products (title, description, price, discount_percentage, rating, stock, brand, category, thumbnail) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [title, description, price, discount_percentage, rating, stock, brand, category, thumbnail]
        );
  
        const productId = result.rows[0].id;
  
        // Si hay imágenes, insertarlas en la tabla product_images
        if (images && images.length > 0) {
          const imagePromises = images.map((imageUrl) => {
            return client.query(
              `INSERT INTO product_images (product_id, image_url) VALUES ($1, $2)`,
              [productId, imageUrl]
            );
          });
  
          // Esperar a que todas las inserciones de imágenes se completen
          await Promise.all(imagePromises);
        }
  
        return productId; // Devolver el id del producto insertado
      });
  
      // Esperar a que todas las inserciones de productos se completen
      const productIds = await Promise.all(productPromises);
  
      // Confirmar la transacción
      await client.query('COMMIT');
      client.release();
  
      res.json({ success: true, productIds });
    } catch (error) {
      // Si ocurre un error, revertir la transacción
      console.error('Error al insertar productos e imágenes:', error);
      if (client) {
        await client.query('ROLLBACK');
        client.release();
      }
      res.status(500).json({ error: 'Error al agregar los productos e imágenes' });
    }
  });
  
  
  

module.exports = router;
