const nano = require('nano')({
  url: 'http://localhost:5984',
  requestDefaults: {
    auth: {
      username: 'partyaksh_005',
      password: 'kamboj'
    }
  }
});

async function manualInit() {
  try {
    console.log('Checking CouchDB connection...');
    
    // Test connection
    const info = await nano.info();
    console.log('CouchDB Info:', info);
    
    // List existing databases
    const dbs = await nano.db.list();
    console.log('Existing databases:', dbs);
    
    // Check if our required databases exist
    const requiredDbs = ['gaming2og5_users', 'gaming2og5_games', 'gaming2og5_ratings'];
    
    console.log('\nRequired databases status:');
    for (const dbName of requiredDbs) {
      if (dbs.includes(dbName)) {
        console.log(`✓ ${dbName} - EXISTS`);
      } else {
        console.log(`✗ ${dbName} - MISSING`);
        // Create the missing database
        await nano.db.create(dbName);
        console.log(`✓ ${dbName} - CREATED`);
      }
    }
    
    console.log('\nAll databases are ready!');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nCouchDB might not be running or is not accessible.');
    console.log('Please make sure CouchDB is running on http://localhost:5984/');
  }
}

manualInit();