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

    result = await utils.sqlQuery(
      'SELECT UTBILDNING_KOD as kurskod, COUNT(AVBROTT_UTBILDNING) as avbrott FROM io_studieresultat WHERE YTTERSTA_KURSPAKETERING_SV = "Civilingenjörsprogram i medieteknik" GROUP BY UTBILDNING_KOD ORDER BY avbrott DESC LIMIT 20'
    );
    res.status(200).send({
      data: result,
    });
  },

  getKursRegistreringsTillfallen: async (req, res) => {
    let kurskod = req.query.kurskod;
    let tillfallen = await utils.sqlQuery(
      'SELECT DISTINCT(YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM) as start_datum FROM IO_REGISTRERING WHERE UTBILDNING_KOD = ? ORDER BY YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM',
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

    //Returnerar ett tal
    let registrerade_personer = await utils.sqlQuery(
      'SELECT COUNT(DISTINCT(PERSONNUMMER)) as antal FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ? AND UTBILDNING_KOD = ?',
      [startdatum, kurskod]
    );

    //Array med exam datum och antalet godkända. Endast TEN1, fixas sen
    let godkanda_personer = await utils.sqlQuery(
      'SELECT COUNT(DISTINCT(PERSONNUMMER)) as antal_personer,EXAMINATIONSDATUM as examinations_datum FROM IO_STUDIERESULTAT WHERE UTBILDNING_KOD = ? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ? AND GILTIGSOMSLUTBETYG = 1 AND MODUL_KOD = "TEN1" GROUP BY EXAMINATIONSDATUM',
      [kurskod, startdatum]
    );

    var res_arr = [];
    //Loopar igenom och ändrar till antalet dagar och procent
    for (var i = 0; i < godkanda_personer.length; i++) {
      res_arr[i] = {
        ...godkanda_personer[i],
        andel_procent:
          (godkanda_personer[i].antal_personer /
            registrerade_personer[0].antal) *
            100 +
          (i > 0 ? res_arr[i - 1].andel_procent : 0),
        antal_dagar: daysBetweenDates(
          startdatum,
          godkanda_personer[i].examinations_datum
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
  return days;
};
