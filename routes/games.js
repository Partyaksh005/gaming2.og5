const express = require('express');
const router = express.Router();
const { getDb, DB_NAMES } = require('../config/couchdb');
const gameDb = getDb(DB_NAMES.GAMES);

// Get all games
router.get('/', async (req, res) => {
  try {
    const result = await gameDb.list({ include_docs: true });
    const games = result.rows.map(row => ({
      _id: row.doc._id,
      _rev: row.doc._rev,
      title: row.doc.title,
      description: row.doc.description,
      category: row.doc.category,
      thumbnailUrl: row.doc.thumbnailUrl,
      uploader: row.doc.uploader,
      uploadDate: row.doc.uploadDate,
      averageRating: row.doc.averageRating || 0
    }));
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ message: 'Error fetching games' });
  }
});

// Get specific game
router.get('/:id', async (req, res) => {
  try {
    const game = await gameDb.get(req.params.id);
    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    if (error.statusCode === 404) {
      res.status(404).json({ message: 'Game not found' });
    } else {
      res.status(500).json({ message: 'Error fetching game' });
    }
  }
});

// Upload game
router.post('/upload', async (req, res) => {
  try {
    const { title, description, category, thumbnailUrl, gameFileUrl } = req.body;
    
    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const gameDoc = {
      title,
      description,
      category,
      thumbnailUrl,
      gameFileUrl,
      uploader: req.user.username,
      uploadDate: new Date().toISOString(),
      ratings: [],
      averageRating: 0
    };
    
    const result = await gameDb.insert(gameDoc);
    res.json({ 
      message: 'Game uploaded successfully', 
      gameId: result.id 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Rate a game
router.post('/:id/rate', async (req, res) => {
  try {
    const { rating } = req.body;
    const gameId = req.params.id;
    
    // Verify user is authenticated
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Get the game
    const game = await gameDb.get(gameId);
    
    // Check if user already rated this game
    const existingRatingIndex = game.ratings.findIndex(r => r.userId === req.user.id);
    
    if (existingRatingIndex !== -1) {
      // Update existing rating
      game.ratings[existingRatingIndex].rating = rating;
    } else {
      // Add new rating
      game.ratings.push({
        userId: req.user.id,
        username: req.user.username,
        rating: rating,
        date: new Date().toISOString()
      });
    }
    
    // Calculate average rating
    const totalRatings = game.ratings.reduce((sum, r) => sum + r.rating, 0);
    game.averageRating = totalRatings / game.ratings.length;
    
    // Update the game
    await gameDb.insert(game);
    
    res.json({ 
      message: 'Rating submitted successfully',
      averageRating: game.averageRating
    });
  } catch (error) {
    console.error('Rating error:', error);
    if (error.statusCode === 404) {
      res.status(404).json({ message: 'Game not found' });
    } else {
      res.status(500).json({ message: 'Error submitting rating' });
    }
  }
});

module.exports = router;