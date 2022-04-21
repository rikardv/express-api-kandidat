/**
 * Functions for handling request
 * Calls sqlQuery function from utils and gets data from database
 */

const utils = require('../setup/utils');

module.exports = {
  getProgramKoder: async (req, res) => {
    //Hämtar alla programkoder
    let result = [];

    result = await utils.sqlQuery(
      'SELECT YTTERSTA_KURSPAKETERING_KOD, YTTERSTA_KURSPAKETERING_SV AS YTTERSTA_KURSPAKETERING_SV FROM IO_REGISTRERING GROUP BY YTTERSTA_KURSPAKETERING_KOD, YTTERSTA_KURSPAKETERING_SV'
    );
    res.status(200).send({
      data: result,
    });
  },

  getKurserFranProgram: async (req, res) => {
    //Hämtar alla kurser som tillhör de valda programmen
    let result = [];
    let programKod = req.query.program;
    params = [programKod];

    // Check if programKod has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }

    //Om endast en kurs skickas tolkas kurskoden som en string.
    if (!Array.isArray(programKod)) {
      result[0] = await utils.sqlQuery(
        //Queary för att hämta alla kurser för valt program
        'SELECT DISTINCT `UTBILDNING_KOD`,`UTBILDNING_SV` FROM `IO_REGISTRERING` WHERE `YTTERSTA_KURSPAKETERING_KOD` = ? AND UTBILDNING_KOD IS NOT NULL',
        programKod
      );
    } else {
      let unique_id = uniqueID();
      //Skapar tillfällig databas för att minska belastning i loop
      let create_DB = await createTempDBCourses(unique_id);
      for (var i = 0; i < programKod.length; i++) {
        result[i] = await utils.sqlQuery(
          'SELECT DISTINCT `UTBILDNING_KOD`,`UTBILDNING_SV` FROM TEMP_REG_COURSES_' +
            unique_id +
            ' WHERE `YTTERSTA_KURSPAKETERING_KOD` = ? AND UTBILDNING_KOD IS NOT NULL',
          programKod[i]
        );
      }
    }
    // Check if results have been returned
    let checkRes = utils.checkResultNotNull(result, res);
    if (checkRes != 0) {
      return checkRes;
    }

    res.status(200).send({
      data: result,
    });
  },

  getProgramStartDatum: async (req, res) => {
    let result = [];
    let programkod = req.query.program;
    params = [programkod];

    // Check if programKod has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }

    if (!Array.isArray(req.query.program)) {
      result[0] = await utils.sqlQuery(
        'SELECT DISTINCT YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM FROM `IO_REGISTRERING` WHERE YTTERSTA_KURSPAKETERING_KOD=? ORDER BY YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM DESC',
        programkod
      );
    } else {
      let unique_id = uniqueID();
      //Skapar tillfällig databas för att minska belastning i loop
      let create_DB = await createTempDBDates(unique_id);
      for (var i = 0; i < req.query.program.length; i++) {
        result[i] = await utils.sqlQuery(
          'SELECT DISTINCT YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM FROM TEMP_REG_DATES_' +
            unique_id +
            ' WHERE YTTERSTA_KURSPAKETERING_KOD=? ORDER BY YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM DESC',
          programkod[i]
        );
      }
    }
    // Check if results have been returned
    let checkRes = utils.checkResultNotNull(result, res);
    if (checkRes != 0) {
      return checkRes;
    }

    res.status(200).send({
      data: result,
    });
  },
};

function uniqueID() {
  return Math.floor(Math.random() * Date.now());
}

let createTempDBDates = async (unique_id) => {
  //Skapa en temporär databas för att hämta alla startdatum för program
  let create_reg_dates = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_REG_DATES_${unique_id} AS SELECT DISTINCT YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM, YTTERSTA_KURSPAKETERING_KOD FROM IO_REGISTRERING`
  );
};

let createTempDBCourses = async (unique_id) => {
  //Skapa en temporär databas för att hämta alla kurser för program
  let create_reg_courses = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_REG_COURSES_${unique_id} AS SELECT  YTTERSTA_KURSPAKETERING_KOD, UTBILDNING_SV, UTBILDNING_KOD FROM IO_REGISTRERING`
  );
};
