// 📁 uploadAndSave.js
// This is just for uploading a static local image to Cloudinary and saving its URL in PostgreSQL
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const { Client } = require('pg');
const path = require('path');

// Cloudinary setup
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// PostgreSQL setup
const client = new Client({
  connectionString: process.env.PG_URI,
});

async function uploadMediaAndSaveToDB() {
  try {
    await client.connect();

    const uploadResult = await cloudinary.uploader.upload(
      path.join(__dirname, 'media', 'sample.jpg'), // 📂 Adjust path if needed
      { folder: 'college-book' }
    );

    const cloudinaryUrl = uploadResult.secure_url;
    console.log("✅ Uploaded to Cloudinary:", cloudinaryUrl);

    const result = await client.query(
      `INSERT INTO posts (user_id, content, media_url)
       VALUES ($1, $2, $3) RETURNING *`,
      [1, 'Test post with local image', cloudinaryUrl]
    );

    console.log("✅ Saved in DB:", result.rows[0]);
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await client.end();
  }
}

uploadMediaAndSaveToDB();
