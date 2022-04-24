/**
 * Functions for handling request
 * Calls sqlQuery function from utils and gets data from database
 */

const utils = require('../setup/utils');

module.exports = {
  getStudentInfo: async (req, res) => {
    let person_nummer = req.query.personnummer;
    let unique_id = Math.floor(Math.random() * Date.now());

    await createTempDB(person_nummer, unique_id);

    let namn = await utils.sqlQuery(
      `SELECT DISTINCT(FORNAMN),EFTERNAMN FROM TEMP_STUDENT_${unique_id}`
    );
    let program = await utils.sqlQuery(
      `SELECT DISTINCT(YTTERSTA_KURSPAKETERING_KOD),YTTERSTA_KURSPAKETERING_SV, YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM, YTTERSTA_KURSPAKETERINGSTILLFALLE_SLUTDATUM FROM TEMP_STUDENT_${unique_id}`
    );
    let kurser = await utils.sqlQuery(
      `SELECT DISTINCT(UTBILDNING_KOD),UTBILDNING_SV FROM TEMP_STUDENT_${unique_id}`,
      person_nummer
    );

    return res.status(200).send({
      data: [{ namn, person_nummer, program, kurser }],
    });
  },

  getStudentGrades: async (req, res) => {
    let person_nummer = req.query.personnummer;
    let table = await utils.sqlQuery(
      `SELECT UTBILDNING_KOD as Kurskod, UTBILDNING_SV as Kurs, AVSER_HEL_KURS as Avklarad, BETYGSVARDE as Betyg, COUNT(CASE BETYGSVARDE WHEN 'U' then 1 else null end) as Omenta, MAX(BESLUTSDATUM) as Beslutsdatum FROM io_studieresultat WHERE PERSONNUMMER=? GROUP BY Kurskod, Kurs, Avklarad, Betyg ORDER BY Omenta DESC`,
      person_nummer
    );
    return res.status(200).send({
      data: table,
    });
  },
};

let createTempDB = async (person_nummer, unique_id) => {
  //Skapa en temporär databas som innehåller resultat:
  //Alla personnummer som fått ett godkänt i kurser med tillhörande start och slutdatum.
  await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_STUDENT_${unique_id} AS SELECT FORNAMN,EFTERNAMN,PERSONNUMMER,UTBILDNING_KOD,UTBILDNING_SV,YTTERSTA_KURSPAKETERING_KOD,YTTERSTA_KURSPAKETERING_SV, YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM, YTTERSTA_KURSPAKETERINGSTILLFALLE_SLUTDATUM FROM IO_REGISTRERING WHERE PERSONNUMMER = ?`,
    person_nummer
  );
};
