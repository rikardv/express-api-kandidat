/**
 * Functions for handling request for testing purposes
 * Calls sqlQuery function from utils and gets data from database
 */

const utils = require("../setup/utils");

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

    result = await utils.sqlQuery(
      'SELECT DISTINCT UTBILDNING_KOD as kurskod, UTBILDNINGSTILLFALLE_STARTDATUM as startdatum, MAX(EXAMINATIONSDATUM) as slutdatum FROM `io_studieresultat` WHERE YTTERSTA_KURSPAKETERING_SV = "Civilingenjörsprogram i medieteknik" AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM="2019-08-19" AND PERSONNUMMER="200004157637" AND BETYGSVARDE != "U" GROUP BY kurskod, startdatum'
    );

    res.status(200).send({
      data: result,
    });
  },
};
