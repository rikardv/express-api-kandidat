/**
 * Functions for handling request
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

  //Hämtar kuser med tillhörande år/termin. Summerar ihop kursutväerderingsbetygen och tar fram ett snittbetyg (SNITT_BETYG).
  //Tar in antalet som parameter
  getKursUtvarderingsBetyg: async (req, res) => {
    let result = [];
    let limit = req.query.limit;
    result = await utils.sqlQuery(
      //Quearyn har för tillfället en DESC LIMIT på 10
      'SELECT `UTBILDNING_KOD`,CONCAT(`AR`,`TERMIN`) AS PERIOD,((`ANDEL_INNEHALL_5`*5+`ANDEL_INNEHALL_4`*4+`ANDEL_INNEHALL_3`*3+`ANDEL_INNEHALL_2`*2+`ANDEL_INNEHALL_1`)/`ANTAL_SVAR`) AS "SNITT_BETYG" FROM evaliuate ORDER BY UTBILDNING_KOD' +
        ` DESC LIMIT ${limit}`
    );
    tempRes = [];
    var kurs = new Object();
    kurs.name = result[0].UTBILDNING_KOD;

    //Kass loop för att formatera daten till ReCharts....
    result.forEach((element) => {
      //För första iterationen
      if (kurs.name != element.UTBILDNING_KOD) {
        tempRes.push(kurs);
        kurs = new Object();
        kurs.name = element.UTBILDNING_KOD;
      }

      if (kurs.name == element.UTBILDNING_KOD) {
        var key = element.PERIOD;
        kurs[key] = element.SNITT_BETYG;
      }
    });
    tempRes.push(kurs);
    result = tempRes;
    res.status(200).send({
      data: result,
    });
  },

  getKurserFranProgram: async (req, res) => {
    //Hämtar alla kurser som tillhör parametern
    //Paramemtern hämtas genom att läsa av URL Tex: http://localhost:8080/getKurserFranProgram?kurskoden=6CDDD, Där parametern paseras på vad som skrivs efter "?"

    //RIKARD! Hojta till om du vill ha det på ett annat sätt :P

    let kursKod = req.query.kurskoden;
    var param = [kursKod];
    console.log(kursKod);
    let result = [];

    quary =
      'SELECT DISTINCT `UTBILDNING_KOD`,`UTBILDNING_SV` FROM `io_registrering` WHERE `YTTERSTA_KURSPAKETERING_KOD` = ?';

    result = await utils.sqlQuery(quary, kursKod);
    res.status(200).send({
      data: result,
    });
  },

  getProgramKoder: async (req, res) => {
    //Hämtar alla programkoder i DT
    let result = [];

    result = await utils.sqlQuery(
      'SELECT DISTINCT `YTTERSTA_KURSPAKETERING_KOD`,`YTTERSTA_KURSPAKETERING_SV`FROM io_registrering'
    );
    res.status(200).send({
      data: result,
    });
  },

  getProgramStartDatum: async (req, res) => {
    let programkod = req.query.program;
    result = await getProgramStartDatum(programkod);

    res.status(200).send({
      data: result,
    });
  },

  getStudenterMedSlapande: async (req, res) => {
    let programkod = req.query.program;
    let start_datum = req.query.startdatum;

    // let reg = await utils.sqlQuery(
    //   `SELECT COUNT(DISTINCT PERSONNUMMER) as antal FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD = ? `,
    //   programkod
    // );

    //let start_datum = await getProgramStartDatum(programkod);

    // let test_datum =
    //   start_datum[2].YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM;

    // let all_results = await utils.sqlQuery(
    //   'SELECT DISTINCT PERSONNUMMER, GILTIGSOMSLUTBETYG, UTBILDNING_KOD, MAX(BESLUTSDATUM), MODUL_KOD FROM `io_studieresultat` WHERE YTTERSTA_KURSPAKETERING_KOD=? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM=? AND BESLUTSDATUM > YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM AND MODUL_KOD!="NULL" AND MODUL_KOD!= "KTR1" AND MODUL_KOD!= "KTR2" AND MODUL_KOD!= "KTR3" GROUP BY PERSONNUMMER, GILTIGSOMSLUTBETYG, UTBILDNING_KOD, MODUL_KOD',
    //   [programkod, test]
    // );

    let person_nummer = await utils.sqlQuery(
      'SELECT DISTINCT PERSONNUMMER FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD=? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM=?',
      [programkod, start_datum]
    );

    let res_arr = [];

    let timer = 0;
    for (var i = 0; i < person_nummer.length; i++) {
      let should_be_completed = await utils.sqlQuery(
        'SELECT COUNT(DISTINCT UTBILDNING_KOD) as antal FROM IO_REGISTRERING WHERE PERSONNUMMER = ? AND YTTERSTA_KURSPAKETERING_KOD = ? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ? AND STUDIEPERIOD_STARTDATUM >= ?',
        [person_nummer[i].PERSONNUMMER, programkod, start_datum, start_datum]
      );

      let actual_completed = await utils.sqlQuery(
        'SELECT COUNT(DISTINCT UTBILDNING_KOD) as antal FROM IO_STUDIERESULTAT WHERE AVSER_HEL_KURS = 1 AND PERSONNUMMER = ? AND YTTERSTA_KURSPAKETERING_KOD = ? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ? AND UTBILDNINGSTILLFALLE_STARTDATUM >= ?',
        [person_nummer[i].PERSONNUMMER, programkod, start_datum, start_datum]
      );

      let diff = should_be_completed[0].antal - actual_completed[0].antal;

      res_arr[i] = diff;

      console.log(timer, person_nummer.length);
      timer++;
      // for(var i = 0; res_arr.length; i++){

      //   if(diff != res){
      //   //Lägg till i array
      //   res.push({
      //     diff: 0,
      //   })
      //   }

      //   else{
      //     //Plussa på i array
      //   }
      // }
    }

    const count = {};

    for (const element of res_arr) {
      if (count[element]) {
        count[element] += 1;
      } else {
        count[element] = 1;
      }
    }

    console.log(count);

    res.status(200).send({
      data: [],
    });
  },
};

let getProgramStartDatum = async (programkod) => {
  let start_dates = await utils.sqlQuery(
    'SELECT DISTINCT YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM FROM `io_registrering` WHERE YTTERSTA_KURSPAKETERING_KOD=? ORDER BY YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM DESC',
    programkod
  );

  return start_dates;
};
