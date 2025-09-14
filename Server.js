require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const ConnectCouchDB = require('connect-couchdb')(session); // Add this line

// Import CouchDB initialization
const { initDatabases } = require('./config/couchdb');

// Import routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const uploadRoutes = require('./routes/upload');

// Import utils
const { findUserByGoogleId, createUser, findUserByEmail, updateUser, findUserById } = require('./utils/couchdbUtils');

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CouchDB session store
const couchDBStoreOptions = {
  name: 'sessions', // Name of the sessions database
  host: process.env.COUCHDB_HOST || 'localhost',
  port: process.env.COUCHDB_PORT || 5984,
  username: process.env.COUCHDB_USER,
  password: process.env.COUCHDB_PASSWORD,
  // Use the same protocol as your CouchDB connection
  secure: false, // Set to true if using HTTPS
};

// Session configuration - UPDATED
app.use(session({
  store: new ConnectCouchDB(couchDBStoreOptions),
  secret: process.env.SESSION_SECRET || 'fallback_secret_for_development',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Generate JWT token function
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      username: user.username, 
      email: user.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists with this Google ID
      let user = await findUserByGoogleId(profile.id);
      
      if (user) {
        return done(null, user);
      }
      
      // Check if user exists with this email
      user = await findUserByEmail(profile.emails[0].value);
      
      if (user) {
        // Update existing user with Google ID
        user.googleId = profile.id;
        await updateUser(user._id, { googleId: profile.id });
        return done(null, user);
      }
      
      // Create new user
      const newUser = await createUser({
        username: profile.displayName,
        email: profile.emails[0].value,
        googleId: profile.id,
        avatar: profile.photos[0].value,
        createdAt: new Date().toISOString()
      });
      
      return done(null, newUser);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// JWT authentication middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL
    : 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000 // requests per window
});
app.use(limiter);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/upload', authenticateJWT, uploadRoutes);

// Google OAuth routes
app.get('/api/auth/google', passport.authenticate('google', {
  scope: ['profile', 'email']
}));

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login` }),
  (req, res) => {
    // Generate JWT token
    const token = generateToken(req.user);
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);
  }
);

// User profile endpoint
app.get('/api/users/me', authenticateJWT, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user data without password
    const { password, ...userData } = user;
    res.json(userData);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'gaming.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize CouchDB and start server
async function startServer() {
  try {
    await initDatabases();
    console.log('CouchDB initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to initialize databases:', error.message);
    
    // Check if the error is about not having admin privileges
    if (error.message && error.message.includes('not a server admin')) {
      console.log('Note: Using existing databases without admin privileges');
      console.log('Server running with existing databases');
      
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    } else {
      console.error('Fatal error: Could not connect to database');
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();