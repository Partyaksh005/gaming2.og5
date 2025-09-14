const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { getDb, DB_NAMES } = require('../config/couchdb');
const gameDb = getDb(DB_NAMES.GAMES);

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Upload game endpoint
router.post('/', upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'gameFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, description, category } = req.body;
    
    // Check if files were uploaded
    if (!req.files || !req.files.thumbnail || !req.files.gameFile) {
      return res.status(400).json({ message: 'Thumbnail and game file are required' });
    }
    
    const thumbnailFile = req.files.thumbnail[0];
    const gameFile = req.files.gameFile[0];
    
    // Upload thumbnail to Cloudinary
    const thumbnailUpload = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'gaming2og5/thumbnails',
          resource_type: 'image'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      uploadStream.end(thumbnailFile.buffer);
    });
    
    // Upload game file to Cloudinary
    const gameFileUpload = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'gaming2og5/games',
          resource_type: 'raw'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      
      uploadStream.end(gameFile.buffer);
    });
    
    // Wait for both uploads to complete
    const [thumbnailResult, gameFileResult] = await Promise.all([thumbnailUpload, gameFileUpload]);
    
    // Create game document
    const gameDoc = {
      title,
      description,
      category,
      thumbnailUrl: thumbnailResult.secure_url,
      gameFileUrl: gameFileResult.secure_url,
      uploader: req.user.username,
      uploaderId: req.user.id,
      uploadDate: new Date().toISOString(),
      ratings: [],
      averageRating: 0
    };
    
    // Save to database
    const result = await gameDb.insert(gameDoc);
    
    res.json({ 
      message: 'Game uploaded successfully', 
      gameId: result.id,
      thumbnailUrl: thumbnailResult.secure_url
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed: ' + error.message });
  }
});

module.exports = router;