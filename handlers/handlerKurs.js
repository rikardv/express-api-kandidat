/**
 * Functions for handling request
 * Calls sqlQuery function from utils and gets data from database
 */

const utils = require('../setup/utils');

module.exports = {
  getKursInfo: async (req, res) => {
    let result = [];
    let kurskod = req.query.kurskod;
    let unique_id = Math.floor(Math.random() * Date.now());
    await createTempDB(kurskod, unique_id);

    let registrering = await utils.sqlQuery(
      `SELECT COUNT(DISTINCT PERSONNUMMER) as antal, COUNT(AVBROTT_UTBILDNING) as avhopp, STUDIEPERIOD_STARTDATUM as startdatum FROM TEMP_REG_${unique_id} GROUP BY STUDIEPERIOD_STARTDATUM`
    );

    let studieresultat = await utils.sqlQuery(
      `SELECT BETYGSVARDE as betyg, COUNT(BETYGSVARDE) as antal, UTBILDNINGSTILLFALLE_STARTDATUM as startdatum  FROM TEMP_RES_${unique_id} GROUP BY UTBILDNINGSTILLFALLE_STARTDATUM , BETYGSVARDE`
    );

    let temp = [];
    registrering.map((res) => {
      let betyg = [];
      let betygsfordelning = [];
      let fail = 0;
      let avklarade = 0;
      studieresultat.map((res2) => {
        if (res.startdatum == res2.startdatum) {
          betygsfordelning.push(res2.antal);
          betyg.push(res2.betyg);
          avklarade += res2.antal;
        }
      });
      fail = res.antal - avklarade;
      betygsfordelning.push(fail);
      betyg.push('U');

      temp.push({
        Startdatum: res.startdatum,
        Registrerade: res.antal,
        Avklarade: avklarade,
        Betyg: betyg,
        Betygsfördelning: betygsfordelning,
        Avhopp: res.avhopp,
      });
    });
    let id = 0;
    result = temp.map((res) => {
      return { ...res, id: id++ };
    });

    res.status(200).send({
      data: result,
    });
  },
};

let createTempDB = async (kursKod, unique_id) => {
  //Skapa en temporär databas som innehåller regisrering:
  //Alla personnummer, startdatum och avbrott för kurs.
  await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_REG_${unique_id} AS SELECT PERSONNUMMER,STUDIEPERIOD_STARTDATUM,AVBROTT_UTBILDNING FROM IO_REGISTRERING WHERE UTBILDNING_KOD = ?`,
    kursKod
  );

  //Skapa en temporär databas som innehåller resultat:
  //Alla personnummer, startdatum och betyg för kurs.
  await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_RES_${unique_id} AS SELECT PERSONNUMMER,BETYGSVARDE, UTBILDNINGSTILLFALLE_STARTDATUM  FROM IO_STUDIERESULTAT WHERE AVSER_HEL_KURS='1' AND UTBILDNING_KOD= ? `,
    kursKod
  );
};
