/**
 * Functions for handling request for testing purposes
 * Calls sqlQuery function from utils and gets data from database
 */

const utils = require('../setup/utils');

module.exports = {
  getBetyg: async (req, res) => {
    let result = [];
    result = await utils.sqlQuery(
      'SELECT BETYGSVARDE AS betyg, COUNT(BETYGSVARDE) AS antal FROM io_studieresultat WHERE UTBILDNING_KOD="TNG033" GROUP BY BETYGSVARDE'
    );

    res.status(200).send({
      data: result,
    });
  },

  getAvbrott: async (req, res) => {
    let result = [];
    let program = req.query.program;
    let start = req.query.startDatum;
    let slut = req.query.slutDatum;
    result = await utils.sqlQuery(
      'SELECT UTBILDNING_KOD as kurskod, COUNT(AVBROTT_UTBILDNING) as avbrott FROM io_studieresultat WHERE YTTERSTA_KURSPAKETERING_KOD = ?  AND AVBROTT_UTBILDNING BETWEEN ? AND ? GROUP BY UTBILDNING_KOD HAVING COUNT(AVBROTT_UTBILDNING) > 0 ORDER BY avbrott DESC',
      [program, start, slut]
    );

    res.status(200).send({
      data: result,
    });
  },

  getKursRegistreringsTillfallen: async (req, res) => {
    let kurskod = req.query.kurskod;
    let tillfallen = await utils.sqlQuery(
      'SELECT DISTINCT(STUDIEPERIOD_STARTDATUM) as start_datum FROM IO_REGISTRERING WHERE UTBILDNING_KOD = ? ORDER BY STUDIEPERIOD_STARTDATUM',
      kurskod
    );

    res.status(200).send({
      data: tillfallen,
    });

    return;
  },

  getDagar: async (req, res) => {
    let kurskod = req.query.kurskod;
    let startdatum = req.query.startdatum;

    //Returnerar antalet som registretas på kursen.
    let registrerade_personer = await utils.sqlQuery(
      'SELECT COUNT(PERSONNUMMER) as antal FROM `io_registrering` WHERE UTBILDNING_KOD= ?  AND STUDIEPERIOD_STARTDATUM = ? GROUP BY UTBILDNING_KOD',
      [kurskod, startdatum]
    );

    //Array med datum man blev klar med kursen och antalet godkända.
    let godkanda_personer = await utils.sqlQuery(
      'SELECT COUNT(PERSONNUMMER) as antal_personer, BESLUTSDATUM FROM `io_studieresultat` WHERE AVSER_HEL_KURS=1 AND UTBILDNING_KOD= ?  AND UTBILDNINGSTILLFALLE_STARTDATUM = ? GROUP BY UTBILDNING_KOD, BESLUTSDATUM',
      [kurskod, startdatum]
    );

    var res_arr = [];
    res_arr[0] = {
      andel_procent: 0,
      antal_dagar: 0,
      start_datum: startdatum,
    };

    //Loopar igenom och ändrar till antalet dagar och procent
    for (var i = 0; i < godkanda_personer.length; i++) {
      res_arr[i + 1] = {
        ...godkanda_personer[i],
        andel_procent:
          Math.round(
            ((godkanda_personer[i].antal_personer /
              registrerade_personer[0].antal) *
              100 +
              (i > 0 ? res_arr[i].andel_procent : 0)) *
              100
          ) / 100,
        antal_dagar: daysBetweenDates(
          startdatum,
          godkanda_personer[i].BESLUTSDATUM
        ),
        start_datum: startdatum,
      };
    }

    res.status(200).send({
      data: res_arr,
    });
  },
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
