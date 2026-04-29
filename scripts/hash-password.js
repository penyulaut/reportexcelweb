const bcrypt = require('bcryptjs');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node hash-password.js <username> <password>');
  process.exit(1);
}

const saltRounds = 10;
bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }
  
  console.log('Username:', username);
  console.log('Password:', password);
  console.log('Hash    :', hash);
  console.log('\nSQL Insert Example:');
  console.log(`INSERT INTO users (username, password) VALUES ('${username}', '${hash}');`);
});
