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
    let tableBetyg = await utils.sqlQuery(
      `SELECT UTBILDNING_KOD as Kurskod, UTBILDNING_SV as Kurs, MAX(BETYGSVARDE) as Betyg, BESLUTSDATUM as Beslutsdaum FROM io_studieresultat WHERE AVSER_HEL_KURS='1' AND PERSONNUMMER= ? GROUP BY Kurskod, Kurs, Beslutsdaum`,
      person_nummer
    );

    let tableOmtentor = await utils.sqlQuery(
      `SELECT UTBILDNING_KOD as Kurskod, COUNT(CASE BETYGSVARDE WHEN 'U' then 1 else null end) as Omentor FROM io_studieresultat WHERE PERSONNUMMER=? GROUP BY Kurskod, Kurs ORDER BY Omentor DESC`,
      person_nummer
    );

    return res.status(200).send({
      data: tableBetyg,
    });
  },
};

let createTempDB = async (person_nummer, unique_id) => {
  //Skapa en temporär databas som innehåller resultat:
  //Alla personnummer som fått ett godkänt i kurser med tillhörande start och slutdatum.
  await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_STUDENT_${unique_id} AS SELECT FORNAMN,EFTERNAMN,PERSONNUMMER,UTBILDNING_KOD,UTBILDNING_SV,STUDIEPERIOD_STARTDATUM,YTTERSTA_KURSPAKETERING_KOD,YTTERSTA_KURSPAKETERING_SV, YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM, YTTERSTA_KURSPAKETERINGSTILLFALLE_SLUTDATUM FROM IO_REGISTRERING WHERE PERSONNUMMER = ?`,
    person_nummer
  );
};
