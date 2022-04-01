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

  getDagar: async (req, res) => {
    let result = [];
    let result2 = [];
    let kurskod = req.query.kurskod;
    let startdatum = req.query.startdatum;

    result = await utils.sqlQuery(
      'SELECT PERSONNUMMER as pnr, UTBILDNING_KOD as kurskod, GILTIGSOMSLUTBETYG as failOrPass, MAX(EXAMINATIONSDATUM) as tentaDatum, UTBILDNINGSTILLFALLE_STARTDATUM as kursStart FROM `io_studieresultat` WHERE YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM= ' +
        ` '${startdatum}' AND YTTERSTA_KURSPAKETERING_SV="Civilingenjörsprogram i medieteknik" AND UTBILDNING_KOD =` +
        ` '${kurskod}' GROUP BY pnr, kurskod, failOrPass, kursStart ORDER BY kursStart ASC`
    );

    result2 = await utils.sqlQuery(
      'SELECT COUNT(DISTINCT PERSONNUMMER) as pnr, UTBILDNING_KOD as kurskod FROM `io_registrering` WHERE YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM= ' +
        ` '${startdatum}' AND YTTERSTA_KURSPAKETERING_SV="Civilingenjörsprogram i medieteknik" AND UTBILDNING_KOD = ` +
        ` '${kurskod}' GROUP BY kurskod`
    );

    res.status(200).send({
      data: result,
      data2: result2,
    });
  },
};
