const app = require('express')();
const mysql = require('mysql');
const utils = require('./utils');
var cors = require('cors');

const PORT = 8080;

app.use(cors());

//Start to listen att a set port and log a message
app.listen(PORT, () =>
  console.log(`Vårt api ligger och chillar på http://localhost:${PORT}`)
);

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
app.get('/test/graph', async (req, res) => {
  let result = [];

  result = await utils.sqlQuery(
    'SELECT BETYGSVARDE AS betyg, COUNT(BETYGSVARDE) AS antal FROM io_studieresultat WHERE UTBILDNING_KOD="TNG033" GROUP BY BETYGSVARDE'
  );
  res.status(200).send({
    data: result,
  });
});
