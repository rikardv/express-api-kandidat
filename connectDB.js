/**
 * Makes the connection to the database.
 */

const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  port: '8889',
  database: 'kandidat',
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('Connected to database');
});

module.exports = db;
