const nano = require('nano');
require('dotenv').config();

const connectionUrl = process.env.DB_URL || 'http://localhost:5984';
const couch = nano(connectionUrl);

const DB_NAMES = {
  USERS: 'gaming2og5_users',
  GAMES: 'gaming2og5_games',
  RATINGS: 'gaming2og5_ratings'
};

const initDatabases = async () => {
  try {
    console.log('Initializing CouchDB databases...');
    
    for (const [dbKey, dbName] of Object.entries(DB_NAMES)) {
      try {
        await couch.db.create(dbName);
        console.log(`Database ${dbName} created successfully`);
        
        // Create necessary indexes
        if (dbName === DB_NAMES.USERS) {
          const db = couch.db.use(dbName);
          await db.createIndex({
            index: { fields: ['email'] },
            name: 'email-index'
          });
          await db.createIndex({
            index: { fields: ['username'] },
            name: 'username-index'
          });
          await db.createIndex({
            index: { fields: ['googleId'] },
            name: 'googleId-index'
          });
          console.log(`Indexes created for ${dbName}`);
        }
      } catch (err) {
        if (err.statusCode === 412) {
          console.log(`Database ${dbName} already exists`);
        } else {
          console.error(`Error creating database ${dbName}:`, err.message);
        }
      }
    }
    
    console.log('CouchDB databases initialized successfully');
  } catch (error) {
    console.error('Failed to initialize CouchDB:', error.message);
    throw error;
  }
};

const getDb = (dbName) => {
  return couch.db.use(dbName);
};

module.exports = {
  couch,
  getDb,
  initDatabases,
  DB_NAMES
};