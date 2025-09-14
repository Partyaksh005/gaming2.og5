const { getDb, DB_NAMES } = require('../config/couchdb');

const userDb = getDb(DB_NAMES.USERS);
const gameDb = getDb(DB_NAMES.GAMES);
const ratingDb = getDb(DB_NAMES.RATINGS);

// User functions
const findUserByEmail = async (email) => {
  try {
    const result = await userDb.find({ 
      selector: { email: email },
      limit: 1
    });
    return result.docs.length > 0 ? result.docs[0] : null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
};

const findUserByUsername = async (username) => {
  try {
    const result = await userDb.find({ 
      selector: { username: username },
      limit: 1
    });
    return result.docs.length > 0 ? result.docs[0] : null;
  } catch (error) {
    console.error('Error finding user by username:', error);
    throw error;
  }
};

const createUser = async (userData) => {
  try {
    const response = await userDb.insert(userData);
    return { ...userData, _id: response.id, _rev: response.rev };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

const findUserByGoogleId = async (googleId) => {
  try {
    const result = await userDb.find({ 
      selector: { googleId: googleId },
      limit: 1
    });
    return result.docs.length > 0 ? result.docs[0] : null;
  } catch (error) {
    console.error('Error finding user by googleId:', error);
    throw error;
  }
};

const findUserById = async (id) => {
  try {
    return await userDb.get(id);
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    }
    console.error('Error finding user by ID:', error);
    throw error;
  }
};

const updateUser = async (id, updates) => {
  try {
    const user = await userDb.get(id);
    const updatedUser = { ...user, ...updates };
    const response = await userDb.insert(updatedUser);
    return { ...updatedUser, _rev: response.rev };
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

module.exports = {
  findUserByEmail,
  findUserByUsername,
  createUser,
  findUserByGoogleId,
  findUserById,
  updateUser
};