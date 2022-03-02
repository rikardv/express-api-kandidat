const app = require('express')();
const mysql = require('mysql');
var cors = require('cors');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  port: '8889',
  password: 'root',
  database: 'kandidat',
});
const PORT = 8080;

app.use(cors());

//Start to listen att a set port and log a message
app.listen(PORT, () =>
  console.log(`Vårt api ligger och chillar på http://localhost:${PORT}`)
);

//Connect to mysql
connection.connect();

//Add an test endpoint to the api.
//res is incoming data, res is the data to be returned
app.get('/test', (req, res) => {
  connection.query(
    'SELECT PERSONNUMMER,FODELSEAR,EFTERNAMN,FORNAMN,UTBILDNING_SV FROM IO_STUDIERESULTAT LIMIT 1000',
    (err, rows, fields) => {
      res.status(200).send({
        data: rows,
      });
    }
  );
});

//Add an graph test endpoint to the api.
//res is incoming data, res is the data to be returned
app.get('/test/graph', (req, res) => {
  let result = [];
  connection.query(
    'SELECT COUNT(BETYGSVARDE) AS BETYG_4 FROM IO_STUDIERESULTAT WHERE UTBILDNING_KOD="TNG033" AND BETYGSVARDE="4"',
    (err, first, fields) => {
      connection.query(
        'SELECT COUNT(BETYGSVARDE) AS BETYG_3 FROM IO_STUDIERESULTAT WHERE UTBILDNING_KOD="TNG033" AND BETYGSVARDE="3"',
        (err, second, fields) => {
          res.status(200).send({
            data: [first[0], second[0]],
          });
        }
      );
    }
  );
});
