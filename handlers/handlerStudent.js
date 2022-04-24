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

    //Tabellen innehåller kurskod, kurs, betygsvärde och beslutsdatum.
    let tableBetyg = await utils.sqlQuery(
      `SELECT UTBILDNING_KOD as kurskod, UTBILDNING_SV as kurs, MAX(BETYGSVARDE) as betyg, BESLUTSDATUM as beslutsdatum FROM io_studieresultat WHERE AVSER_HEL_KURS='1' AND PERSONNUMMER= ? GROUP BY kurskod, kurs, beslutsdatum`,
      person_nummer
    );

    //Tabellen innehåller kurskod och antal omtentor.
    let tableOmtentor = await utils.sqlQuery(
      `SELECT UTBILDNING_KOD as kurskod, COUNT(CASE BETYGSVARDE WHEN 'U' then 1 else null end) as omtentor FROM io_studieresultat WHERE PERSONNUMMER=? GROUP BY kurskod ORDER BY omtentor DESC`,
      person_nummer
    );

    //Lägg till Omtentor i tabellen tableBetyg

    /*KOD KOD KOD */

    //Tabellen innehåller kurskod och startdatum för kurs.
    let tableRegistrering = await utils.sqlQuery(
      `SELECT UTBILDNING_KOD as kurs_kod, STUDIEPERIOD_STARTDATUM as start_datum FROM io_registrering WHERE PERSONNUMMER=?`,
      person_nummer
    );

    //Beräkna antal dagar mellan påbörjad och avslutad kurs och lägg till i tabellen.

    /*KOD KOD KOD */

    let id = 0;
    tableBetyg = tableBetyg.map((res) => {
      return { ...res, id: id++ };
    });
    let id_second = 0;
    tableOmtentor = tableOmtentor.map((res) => {
      return { ...res, id: id_second++ };
    });

    return res.status(200).send({
      data: { tableBetyg, tableOmtentor },
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
