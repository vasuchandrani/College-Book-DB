// 📁 server.js
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' }); // Store temporarily

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// PostgreSQL config
const client = new Client({
  connectionString: process.env.PG_URI,
});

client.connect()
  .then(() => console.log("📦 Connected to PostgreSQL"))
  .catch(err => console.error("❌ PG Error:", err));

// Parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// delete image route
app.delete('/post/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Get the post from DB
    const result = await client.query(`SELECT * FROM posts WHERE id = $1`, [id]);
    const post = result.rows[0];

    if (!post) return res.status(404).json({ message: 'Post not found' });

    // 2. Extract public_id from media_url
    const parts = post.media_url.split('/');
    const fileWithExtension = parts[parts.length - 1];
    const publicId = `college-book/${fileWithExtension.split('.')[0]}`;

    // 3. Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // 4. Delete from PostgreSQL
    await client.query(`DELETE FROM posts WHERE id = $1`, [id]);

    res.status(200).json({ message: '✅ Post and image deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// 📤 Route: Upload image and store in DB
app.post('/upload', upload.single('image'), async (req, res) => {
  const filePath = req.file?.path;
  const { user_id = 1, content = '' } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'Image file is required' });
  }

  try {
    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: 'college-book',
    });

    const cloudinaryUrl = uploadResult.secure_url;

    // Insert post into DB (created_at handled automatically)
    const dbResult = await client.query(
      `INSERT INTO posts (user_id, content, media_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, content, cloudinaryUrl]
    );

    // Remove temporary file
    fs.unlinkSync(filePath);

    // Respond
    res.status(200).json({
      message: '✅ Image uploaded and post saved successfully',
      data: dbResult.rows[0],
    });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Run server
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
