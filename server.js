require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, created_at FROM items ORDER BY id ASC');
    const rows = result.rows.map(
      r => `<li>#${r.id} - ${r.name} <small>(${new Date(r.created_at).toLocaleString()})</small></li>`
    ).join('');

    res.send(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>My First Site</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 720px; margin: 40px auto; line-height: 1.5; }
          input, button { padding: 8px; font-size: 16px; }
          form { margin-bottom: 24px; }
        </style>
      </head>
      <body>
        <h1>My First Database-backed Site</h1>
        <p>This page is reading from PostgreSQL.</p>

        <form method="POST" action="/items">
          <input name="name" placeholder="Add an item" required />
          <button type="submit">Save</button>
        </form>

        <h2>Items</h2>
        <ul>${rows}</ul>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error: ' + err.message);
  }
});

app.post('/items', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send('Name is required');

  try {
    await pool.query('INSERT INTO items (name) VALUES ($1)', [name]);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Insert error: ' + err.message);
  }
});

app.get('/health', (req, res) => {
  res.send('ok');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});