/**
 * Functions for handling request
 * Calls sqlQuery function from utils and gets data from database
 */

const utils = require('../setup/utils');

module.exports = {
  getCSN: async (req, res) => {
    let programkod = req.query.program;
    let start_datum = req.query.startdatum;
    params = [programkod, start_datum];

    // Check if programKod, start_datum has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }

    let result = [];

    var counter = programkod.length;

    //Om bara ett program är valt tolkar den som en string. Isåfall sätter vi counter till 1.
    if (!Array.isArray(programkod)) {
      counter = 1;
    }
    for (var j = 0; j < counter; j++) {
      let unique_id = uniqueID();
      if (counter == 1) {
        let create_DB = await createTempDB(programkod, start_datum, unique_id);
      } else {
        let create_DB = await createTempDB(
          programkod[j],
          start_datum,
          unique_id
        );
      }
      //beräkna alla unika personnummer som läser programmet från den temporära registreringsdatabasen.
      let person_nummer = await utils.sqlQuery(
        `SELECT DISTINCT PERSONNUMMER FROM TEMP_REG_${unique_id}`
      );

      let limit_procent = 0.625; //62.5% HP krävs för att få CSN.
      let limit = 0; //nytt värde för varje personnummer, används för att jämföra antal HP med CSN-gränsen.
      let HP_tot = []; //för att lagra antalet HP varje person läst.
      let HP_completed_tot = []; //för att lagra antalet HP varje person klarat.
      let res_arr = []; //används för att skicka resultat till React.
      let under_limit = 0; //counter för antalet personer som är under CSN-gränsen.
      let percent = 0; //används för att beräkna hur många procent som ej får CSN.

      //Loopa igenom för samtliga personnummer.
      for (var i = 0; i < person_nummer.length; i++) {
        //Hämta antal HP en person avklarat.
        let completed_HP = await utils.sqlQuery(
          `SELECT OMFATTNINGVARDE as HP_G FROM TEMP_RES_${unique_id} WHERE AVSER_HEL_KURS = 1 AND PERSONNUMMER = ?`,
          person_nummer[i].PERSONNUMMER
        );

        //Hämta antal HP en person läst.
        let HP = await utils.sqlQuery(
          `SELECT OMFATTNINGVARDE as HP FROM TEMP_REG_${unique_id} WHERE PERSONNUMMER = ?`,
          person_nummer[i].PERSONNUMMER
        );

        let count_hp = 0;
        //Undviker "bugg"
        if (completed_HP.length != 0) {
          for (var k = 0; k < completed_HP.length; k++) {
            count_hp += completed_HP[k].HP_G; //summera alla HP en person avklarat
          }

          HP_completed_tot[i] = count_hp; //lagra antal hp en person avklarat.
        } else HP_completed_tot[i] = 0; //Om man inte klarat en enda kurs

        count_hp = 0;
        for (var k = 0; k < HP.length; k++) {
          count_hp += HP[k].HP; //summera alla HP en person läst.
        }

        HP_tot[i] = count_hp; //lagra antal hp en person läst.
        limit = limit_procent * HP_tot[i]; //beräkna CSN-gränsen

        //Jämför avklarade HP med CSN-gränsen.
        if (limit > HP_completed_tot[i]) under_limit++; //Om man är under gränsen ökar antalet personer som är under gränsen.

        //Samma igen fast man är högst 12HP över gränsen, dvs nära att inte få CSN.
        if (limit + 12 > HP_completed_tot[i]) {
          percent = HP_completed_tot[i] / limit; //används senare för sortering.
          //lagra resultat
          res_arr[i] = {
            name: person_nummer[i].PERSONNUMMER,
            actual: HP_completed_tot[i],
            required: limit,
            procenten: percent,
          };
        } else {
          //Filtreras bort senare.
          res_arr[i] = {
            required: 0,
          };
        }
      }

      //Formattererar om datan med properties
      const obj = [];
      for (var i = 0; i < res_arr.length; i++) {
        if (res_arr[i].required != 0)
          //Filtreras bort tomma [i].
          obj.push({
            name: res_arr[i].name,
            actual: res_arr[i].actual,
            required: res_arr[i].required,
            procenten: res_arr[i].procenten,
          });
      }

      //Sorterar efter hur många procent av HP man uppnått.
      let sort_HP = obj.sort(function (a, b) {
        return a.procenten - b.procenten;
      });

      result.push({
        program: programkod[j],
        under: under_limit,
        total: person_nummer.length,
        sort_HP,
      });
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

  getSlapande: async (req, res) => {
    let result = [];
    let programkod = req.query.program;
    let start_datum = req.query.startdatum;

    params = [programkod, start_datum];

    // Check if programKod, start_datum has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }

    let counter = programkod.length;
    if (!Array.isArray(programkod)) {
      counter = 1;
    }
    for (var i = 0; i < counter; i++) {
      let unique_id = uniqueID();
      if (counter == 1) {
        //Skapar tillfälliga databaser för programmet för att minska belastning i senare loop
        let create_DB = await createTempDB(programkod, start_datum, unique_id);
      } else {
        let create_DB = await createTempDB(
          programkod[i],
          start_datum,
          unique_id
        );
      }

      let person_nummer = await utils.sqlQuery(
        `SELECT DISTINCT PERSONNUMMER FROM TEMP_REG_${unique_id}`
      );

      let res_arr = [];
      let timer = 0;
      //Går igenom personer och beräknar "borde klarat" och "har klarat"
      for (var j = 0; j < person_nummer.length; j++) {
        let actual_completed = await utils.sqlQuery(
          `SELECT COUNT(DISTINCT UTBILDNING_KOD) as antal FROM TEMP_RES_${unique_id} WHERE AVSER_HEL_KURS = 1 AND PERSONNUMMER = ?`,
          person_nummer[j].PERSONNUMMER
        );

        let should_be_completed = await utils.sqlQuery(
          `SELECT COUNT(DISTINCT UTBILDNING_KOD) as antal FROM TEMP_REG_${unique_id} WHERE PERSONNUMMER = ?`,
          person_nummer[j].PERSONNUMMER
        );

        let diff = should_be_completed[0].antal - actual_completed[0].antal;

        res_arr[j] = diff;

        //Laddningslog för debugging
        process.stdout.write(
          'Loading ' + timer + '/' + person_nummer.length + '\r'
        );
        timer++;
      }

      //Formattererar om datan med properties
      const obj = [];
      for (var k = 0; k < res_arr.length; k++) {
        obj.push({
          name: res_arr[k],
          value: 0,
        });
      }

      //Slår ihop samma värden och properties (för recharts)
      var sum_arr = Object.values(
        obj.reduce((c, { name, value }) => {
          c[name] = c[name] || { name, value: 0 };
          c[name].value += 1;
          return c;
        }, {})
      );

      //Sorterar efter antalet släpande kurser
      let sum_arr_sorted = sum_arr.sort(function (a, b) {
        return a.name - b.name;
      });

      //Default antar vi att alla har släpande kurser.
      let pie = [];
      var slapandeTot = person_nummer.length;
      var noSlapandeTot = 0;

      //Om någon inte har släpande kurser så ändras värdena.
      if (sum_arr_sorted[0].name == 0) {
        slapandeTot = person_nummer.length - sum_arr_sorted[0].value;
        noSlapandeTot = sum_arr_sorted[0].value;
      }
      pie.push({ name: 'Inga släpande', value: noSlapandeTot });
      pie.push({ name: 'Släpande', value: slapandeTot });

      //Lägg till för att använda i rechart
      if (counter == 1) {
        result.push({
          program: programkod,
          data: sum_arr_sorted,
          dataPie: pie,
        });
      } else {
        result.push({
          program: programkod[i],
          data: sum_arr_sorted,
          dataPie: pie,
        });
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

  getBetygsfordelning: async (req, res) => {
    let result = [];
    result = await utils.sqlQuery(
      'SELECT UTBILDNING_KOD AS kurskod, COUNT(BETYGSVARDE) AS value, BETYGSVARDE AS betyg FROM io_studieresultat WHERE YTTERSTA_KURSPAKETERING_KOD="6CMEN" GROUP BY UTBILDNING_KOD, BETYGSVARDE'
    );

    res.status(200).send({
      data: result,
    });
  },

  getAvhopp: async (req, res) => {
    let result = [];
    let program = req.query.program;
    let start = req.query.startDatum;
    let slut = req.query.slutDatum;

    params = [program, start, slut];

    // Check if program,start,slut has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }

    let temp = [];

    if (!Array.isArray(program)) {
      temp = await utils.sqlQuery(
        'SELECT UTBILDNING_KOD as kurskod, COUNT(AVBROTT_UTBILDNING) as avbrott FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD = ?  AND AVBROTT_UTBILDNING BETWEEN ? AND ? AND AVBROTT_UTBILDNING IS NOT NULL GROUP BY UTBILDNING_KOD ORDER BY avbrott DESC',
        [program, start, slut]
      );
      result.push({
        program: program,
        data: temp,
      });
    } else {
      for (var i = 0; i < program.length; i++) {
        temp = await utils.sqlQuery(
          'SELECT UTBILDNING_KOD as kurskod, COUNT(AVBROTT_UTBILDNING) as avbrott FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD = ?  AND AVBROTT_UTBILDNING BETWEEN ? AND ? AND AVBROTT_UTBILDNING IS NOT NULL GROUP BY UTBILDNING_KOD ORDER BY avbrott DESC',
          [program[i], start, slut]
        );
        result.push({
          program: program[i],
          data: temp,
        });
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

  //Hämtar kuser med tillhörande år/termin. Summerar ihop getEvaliuate och tar fram ett snittbetyg (SNITT_BETYG).
  //Tar in antalet som parameter
  getEvaliuate: async (req, res) => {
    let result = [];
    let kursKoder = req.query.kurskod;
    params = [kursKoder];

    // Check if kurskoder has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }

    //Om endast en kurs skickas tolkas kurskoden som en string.
    if (!Array.isArray(kursKoder)) {
      result[0] = await utils.sqlQuery(
        //Quearyn för att hämta alla snittbetyg för kursens år och termin.
        'SELECT `UTBILDNING_KOD`,CONCAT(`AR`,`TERMIN`) AS PERIOD,((`ANDEL_INNEHALL_5`*5+`ANDEL_INNEHALL_4`*4+`ANDEL_INNEHALL_3`*3+`ANDEL_INNEHALL_2`*2+`ANDEL_INNEHALL_1`)/`ANTAL_SVAR`) AS "SNITT_BETYG" FROM EVALIUATE  WHERE UTBILDNING_KOD' +
          ` = "${kursKoder}"` +
          ' ORDER BY UTBILDNING_KOD' +
          ` DESC`
      );
    } else {
      //Hämta data för alla kurser och spara i result.
      for (var i = 0; i < kursKoder.length; i++) {
        result[i] = await utils.sqlQuery(
          //Quearyn för att hämta alla snittbetyg för kursens år och termin.
          'SELECT `UTBILDNING_KOD`,CONCAT(`AR`,`TERMIN`) AS PERIOD,((`ANDEL_INNEHALL_5`*5+`ANDEL_INNEHALL_4`*4+`ANDEL_INNEHALL_3`*3+`ANDEL_INNEHALL_2`*2+`ANDEL_INNEHALL_1`)/`ANTAL_SVAR`) AS "SNITT_BETYG" FROM EVALIUATE  WHERE UTBILDNING_KOD' +
            ` = "${kursKoder[i]}"` +
            ' ORDER BY UTBILDNING_KOD' +
            ` DESC`
        );
      }
    }
    tempRes = [];

    //Formatering till Rechart. Delvis Tims lösning, fråga mig inte hur den fungerar.
    for (var i = 0; i < result.length; i++) {
      var kurs = new Object();
      kurs.name = result[i].UTBILDNING_KOD;
      result[i].forEach((element) => {
        //För första iterationen
        if (kurs.name != element.UTBILDNING_KOD) {
          if (kurs.name != undefined) {
            tempRes.push(kurs);
          }
          kurs = new Object();
          kurs.name = element.UTBILDNING_KOD;
        }

        if (kurs.name == element.UTBILDNING_KOD) {
          var key = element.PERIOD;
          kurs[key] = element.SNITT_BETYG;
        }
      });
      if (kurs.name != undefined) {
        tempRes.push(kurs);
      }
    }
    result = tempRes;

    // Check if results have been returned
    let checkRes = utils.checkResultNotNull(result, res);
    if (checkRes != 0) {
      return checkRes;
    }
    res.status(200).send({
      data: result,
    });
  },

  getKursRegistreringsTillfallen: async (req, res) => {
    let result = [];
    let kurskod = req.query.kurskod;

    params = [kurskod];

    // Check if kurskod has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }

    result = await utils.sqlQuery(
      'SELECT DISTINCT(STUDIEPERIOD_STARTDATUM) as start_datum FROM IO_REGISTRERING WHERE UTBILDNING_KOD = ? ORDER BY STUDIEPERIOD_STARTDATUM',
      kurskod
    );

    // Check if results have been returned
    let checkRes = utils.checkResultNotNull(result, res);
    if (checkRes != 0) {
      return checkRes;
    }

    res.status(200).send({
      data: result,
    });

    return;
  },

  getDagar: async (req, res) => {
    let result = [];
    let kurskod = req.query.kurskod;
    let startdatum = req.query.startdatum;

    params = [kurskod, startdatum];

    // Check if program,start,slut has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }

    //Returnerar antalet som registretas på kursen.
    let registrerade_personer = await utils.sqlQuery(
      'SELECT COUNT(PERSONNUMMER) as antal FROM `IO_REGISTRERING` WHERE UTBILDNING_KOD= ?  AND STUDIEPERIOD_STARTDATUM = ? GROUP BY UTBILDNING_KOD',
      [kurskod, startdatum]
    );

    //Array med datum man blev klar med kursen och antalet godkända.
    let godkanda_personer = await utils.sqlQuery(
      'SELECT COUNT(PERSONNUMMER) as antal_personer, BESLUTSDATUM FROM `IO_STUDIERESULTAT` WHERE AVSER_HEL_KURS=1 AND UTBILDNING_KOD= ?  AND UTBILDNINGSTILLFALLE_STARTDATUM = ? GROUP BY UTBILDNING_KOD, BESLUTSDATUM',
      [kurskod, startdatum]
    );

    result[0] = {
      andel_procent: 0,
      antal_dagar: 0,
      start_datum: startdatum,
    };

    //Loopar igenom och ändrar till antalet dagar och procent
    for (var i = 0; i < godkanda_personer.length; i++) {
      result[i + 1] = {
        ...godkanda_personer[i],
        andel_procent:
          Math.round(
            ((godkanda_personer[i].antal_personer /
              registrerade_personer[0].antal) *
              100 +
              (i > 0 ? result[i].andel_procent : 0)) *
              100
          ) / 100,
        antal_dagar: daysBetweenDates(
          startdatum,
          godkanda_personer[i].BESLUTSDATUM
        ),
        start_datum: startdatum,
      };
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

  getDagarNew: async (req, res) => {
    let result = [];
    let kurskod = req.query.kurskod;
    let start = req.query.startdatum;

    params = [kurskod, start];
    // Check if program,start,slut has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }

    //result.push({ kurs: '', data: { antalDagar: 0, andelProcent: 0 } });
    let counter = kurskod.length;
    //Om bara ett program är valt tolkar den som en string. Isåfall sätter vi counter till 1.
    if (!Array.isArray(kurskod)) {
      counter = 1;
    }

    let registrerade = [];
    let godkanda = [];

    //Loopa för alla kurser.
    for (var i = 0; i < counter; i++) {
      if (counter == 1) {
        //Returnerar array med antalet som registretas på kursen och startdatumen.
        registrerade = await utils.sqlQuery(
          'SELECT COUNT(PERSONNUMMER) as antalStudenter, STUDIEPERIOD_STARTDATUM as startDatum FROM `IO_REGISTRERING` WHERE UTBILDNING_KOD= ?  AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ? AND STUDIEPERIOD_STARTDATUM >= ? GROUP BY STUDIEPERIOD_STARTDATUM',
          [kurskod, start, start]
        );

        //Retunerar array med antalet godkända, startdatum och datumet man blev klar med kursen.
        godkanda = await utils.sqlQuery(
          'SELECT COUNT(PERSONNUMMER) as antalStudenter, UTBILDNINGSTILLFALLE_STARTDATUM as StartDatum, BESLUTSDATUM as SlutDatum FROM `io_studieresultat` WHERE AVSER_HEL_KURS=1 AND UTBILDNING_KOD= ? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ? AND BESLUTSDATUM >= ? GROUP BY UTBILDNINGSTILLFALLE_STARTDATUM, AVSER_HEL_KURS, BESLUTSDATUM',
          [kurskod, start, start]
        );
      } else {
        //Returnerar array med antalet som registretas på kursen och startdatumen.
        let registrerade = await utils.sqlQuery(
          'SELECT COUNT(PERSONNUMMER) as antalStudenter, STUDIEPERIOD_STARTDATUM as startDatum FROM `IO_REGISTRERING` WHERE UTBILDNING_KOD= ?  AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ? AND STUDIEPERIOD_STARTDATUM >= ? GROUP BY STUDIEPERIOD_STARTDATUM',
          [kurskod[i], start, start]
        );

        //Retunerar array med antalet godkända, startdatum och datumet man blev klar med kursen.
        let godkanda = await utils.sqlQuery(
          'SELECT COUNT(PERSONNUMMER) as antalStudenter, UTBILDNINGSTILLFALLE_STARTDATUM as StartDatum, BESLUTSDATUM as SlutDatum FROM `io_studieresultat` WHERE AVSER_HEL_KURS=1 AND UTBILDNING_KOD= ? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ? AND BESLUTSDATUM >= ? GROUP BY UTBILDNINGSTILLFALLE_STARTDATUM, AVSER_HEL_KURS, BESLUTSDATUM',
          [kurskod[i], start, start]
        );
      }

      let temp = [
        {
          antalDagar: 0,
          andelProcent: 0,
        },
      ]; //Resultat lagras temporärt i denna för varje kurs, pushas sen till result.
      let total = 0; //För att beräkna procent som är klar vid respektive slutdatum.
      for (var j = 0; j < registrerade.length; j++) {
        total += registrerade[j].antalStudenter;
      }

      //Loopa alla startdatum för att beräkna dagar och procent.
      for (var j = 0; j < registrerade.length; j++) {
        for (var k = 0; k < godkanda.length; k++) {
          if (registrerade[j].startDatum == godkanda[k].StartDatum) {
            temp.push({
              antalDagar: daysBetweenDates(
                godkanda[k].StartDatum,
                godkanda[k].SlutDatum
              ),
              andelProcent: parseFloat(
                ((godkanda[k].antalStudenter / total) * 100).toFixed(2)
              ),
            });
          }
        }
      }

      //Sorterar efter antalet dagar
      let sort_temp = temp.sort(function (a, b) {
        return a.antalDagar - b.antalDagar;
      });

      let sum = 0;
      let added_temp = sort_temp.map((obj) => {
        return {
          antalDagar: obj.antalDagar,
          andelProcent: (sum += obj.andelProcent),
        };
      });

      //Pusha alla resultat för kursen till result.
      if (counter == 1) result.push({ kurs: kurskod, data: added_temp });
      else result.push({ kurs: kurskod[i], data: added_temp });
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

  getOmtenta: async (req, res) => {
    let result = [];
    result = await utils.sqlQuery(
      'SELECT PERSONNUMMER AS persnr, COUNT(BETYGSVARDE) AS value FROM io_studieresultat WHERE UTBILDNING_KOD="TNA006" AND BETYGGRAD_EN="Fail" AND MODUL_KOD="TEN1" GROUP BY PERSONNUMMER'
    );

    result2 = await utils.sqlQuery(
      'SELECT COUNT(DISTINCT(PERSONNUMMER)) AS value FROM io_studieresultat WHERE UTBILDNING_KOD="TNA006" AND MODUL_KOD="TEN1"'
    );

    result3 = await utils.sqlQuery(
      'SELECT PERSONNUMMER AS persnr FROM io_studieresultat WHERE UTBILDNING_KOD="TNA006" AND BETYGGRAD_EN!="Fail" AND MODUL_KOD="TEN1" GROUP BY PERSONNUMMER'
    );

    res.status(200).send({
      data: result,
      data2: result2,
      data3: result3,
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

let createTempDB = async (programkod, start_datum, unique_id) => {
  //Skapa en temporär databas som innehåller registrering:
  //alla personnummer som registerats på en kurs och HP för kursen samt antalet som gjort avbrott på programmet.
  let create_reg = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_REG_${unique_id} AS SELECT UTBILDNING_KOD,PERSONNUMMER, OMFATTNINGVARDE FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD=? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM=? AND STUDIEPERIOD_STARTDATUM >= ? AND STUDIEPERIOD_SLUTDATUM <= "2022-02-23" AND AVBROTT_YTTERSTAKURSPAKETERING IS NULL `,
    [programkod, start_datum, start_datum]
  );
  //Skapa en temporär databas som innehåller resultat:
  //alla personnummer som fått ett resultat på en kurs och HP för kursen.
  let create_res = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_RES_${unique_id} AS SELECT UTBILDNING_KOD,AVSER_HEL_KURS,PERSONNUMMER, OMFATTNINGVARDE FROM IO_STUDIERESULTAT WHERE YTTERSTA_KURSPAKETERING_KOD=? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM=? AND UTBILDNINGSTILLFALLE_STARTDATUM >= ? AND AVBROTT_YTTERSTAKURSPAKETERING IS NULL`,
    [programkod, start_datum, start_datum]
  );
};

function uniqueID() {
  return Math.floor(Math.random() * Date.now());
}
