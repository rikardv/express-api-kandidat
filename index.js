/**
 * Ställer in alla parametrar för API:et och låter den ligga på en port
 */

const app = require('express')();
const mysql = require('mysql');
const utils = require('./utils');
var cors = require('cors');
const PORT = 8080;
app.use(cors());
app.listen(PORT, () =>
  console.log(`Vårt api ligger och chillar på http://localhost:${PORT}`)
);

/**
 * Alla API endpoints defineras nedan
 */

// Test API endpoint för att hämta personnummer och lite annat
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

//Test API endpoint för att hämta fördelningen av betyg i en kurs
app.get('/test/betyg', async (req, res) => {
  let result = [];

  result = await utils.sqlQuery(
    'SELECT BETYGSVARDE AS betyg, COUNT(BETYGSVARDE) AS antal FROM io_studieresultat WHERE UTBILDNING_KOD="TNG033" GROUP BY BETYGSVARDE'
  );
  res.status(200).send({
    data: result,
  });
});

//Test API endpoint för att hämta antal avbrott i MTs kurser
app.get('/test/avbrott', async (req, res) => {
  let result = [];

  result = await utils.sqlQuery(
    'SELECT UTBILDNING_KOD as kurskod, COUNT(AVBROTT_UTBILDNING) as avbrott FROM io_studieresultat WHERE YTTERSTA_KURSPAKETERING_SV = "Civilingenjörsprogram i medieteknik" GROUP BY UTBILDNING_KOD ORDER BY avbrott DESC LIMIT 20'
  );
  res.status(200).send({
    data: result,
  });
});
