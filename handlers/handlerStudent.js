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
      `SELECT UTBILDNING_KOD as kurskod, MAX(BETYGSVARDE) as betyg, BESLUTSDATUM as beslutsdatum FROM io_studieresultat WHERE AVSER_HEL_KURS='1' AND PERSONNUMMER= ? GROUP BY kurskod, beslutsdatum`,
      person_nummer
    );

    //Tabellen innehåller kurskod och antal omtentor.
    let tableOmtentor = await utils.sqlQuery(
      `SELECT UTBILDNING_KOD as kurskod, COUNT(CASE BETYGSVARDE WHEN 'U' then 1 else null end) as omtentor FROM io_studieresultat WHERE PERSONNUMMER=? GROUP BY kurskod ORDER BY omtentor DESC`,
      person_nummer
    );

    //Tabellen innehåller kurskod och startdatum för kurs.
    let tableRegistrering = await utils.sqlQuery(
      `SELECT UTBILDNING_KOD as kurskod, UTBILDNING_SV as kurs, MAX(STUDIEPERIOD_STARTDATUM) as start_datum FROM io_registrering WHERE PERSONNUMMER=? GROUP BY kurskod, kurs ORDER BY start_datum ASC`,
      person_nummer
    );

    //Lägg till id, betyg och antal dagar till avklarad kurs i registreringstabellen.
    let id = 0;
    tableRegistrering = tableRegistrering.map((res) => {
      let betyg = '-';
      let dagar = Number('-');
      let avklarad = 'Nej';
      tableBetyg.map((res2) => {
        //Resultat för avklarad kurs läggs till här
        if (res.kurskod == res2.kurskod) {
          dagar = daysBetweenDates(res.start_datum, res2.beslutsdatum); //Beräkna dagar till avklarad kurs
          betyg = res2.betyg;
          avklarad = 'Ja';
        }
      });

      return {
        ...res,
        id: id++,
        betyg: betyg,
        dagar: dagar,
        avklarad: avklarad,
      };
    });

    //Lägg till antal omtentor i registreringstabellen.
    tableRegistrering = tableRegistrering.map((res) => {
      let omtentor = 0;
      tableOmtentor.map((res2) => {
        //Resultat för avklarad kurs läggs till här
        if (res.kurskod == res2.kurskod) {
          omtentor = res2.omtentor;
        }
      });

      return { ...res, omtentor: omtentor };
    });

    res.status(200).send({
      data: tableRegistrering,
    });
  },

  getStudenter: async (req, res) => {
    let programKod = req.query.programKod;
    let startDatum = req.query.startDatum;
    let unique_id = Math.floor(Math.random() * Date.now());

    await createTempDB2(programKod, startDatum, unique_id);

    let studenter = await utils.sqlQuery(
      `SELECT  FORNAMN,EFTERNAMN,PERSONNUMMER,YTTERSTA_KURSPAKETERING_SV, YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM, YTTERSTA_KURSPAKETERINGSTILLFALLE_SLUTDATUM FROM TEMP_STUDENT_${unique_id}`
    );

    let id = 0;
    studenter = studenter.map((res) => {
      return { ...res, id: id++ };
    });

    res.status(200).send({
      data: studenter,
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

let createTempDB2 = async (programKod, startDatum, unique_id) => {
  //Skapa en temporär databas som innehåller resultat:
  //Alla personnummer som fått ett godkänt i kurser med tillhörande start och slutdatum.
  await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_STUDENT_${unique_id} AS SELECT DISTINCT FORNAMN,EFTERNAMN,PERSONNUMMER,YTTERSTA_KURSPAKETERING_SV, YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM, YTTERSTA_KURSPAKETERINGSTILLFALLE_SLUTDATUM FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD=? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ?`,
    [programKod, startDatum]
  );
};

let daysBetweenDates = (start, end) => {
  var date1 = new Date(end);
  var date2 = new Date(start);
  var difference = date1.getTime() - date2.getTime();
  var days = Math.ceil(difference / (1000 * 3600 * 24));
  //Utifall någon läst kursen vid ett tidigare tillfälle.
  if (days < 0) {
    days = 0;
  }

  return days;
};
