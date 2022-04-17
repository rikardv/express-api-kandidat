/**
 * Makes the connection to the database.
 */

const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  port: '3306',
  database: 'kandidat',
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('Uppkoppling mot databas lyckades...');
});

module.exports = db;
