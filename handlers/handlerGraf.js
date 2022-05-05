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
      programkod = [programkod];
      counter = 1;
    }

    for (var j = 0; j < counter; j++) {
      let unique_id = uniqueID();

      let create_DB = await createTempDB(programkod[j], start_datum, unique_id);

      //beräkna alla unika personnummer som läser programmet från den temporära registreringsdatabasen.
      let person_nummer = await utils.sqlQuery(
        `SELECT DISTINCT PERSONNUMMER FROM TEMP_REG_${unique_id}`
      );

      let program_namn = await utils.sqlQuery(
        `SELECT DISTINCT YTTERSTA_KURSPAKETERING_SV FROM TEMP_REG_${unique_id}`
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
        program_namn: program_namn[0].YTTERSTA_KURSPAKETERING_SV,
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
    let total = 0;
    let total_slapande = 0;
    if (!Array.isArray(programkod)) {
      programkod = [programkod];
      counter = 1;
    }
    for (var i = 0; i < counter; i++) {
      let unique_id = uniqueID();

      let create_DB = await createTempDB(programkod[i], start_datum, unique_id);

      let person_nummer = await utils.sqlQuery(
        `SELECT DISTINCT PERSONNUMMER FROM TEMP_REG_${unique_id}`
      );

      let program_namn = await utils.sqlQuery(
        `SELECT DISTINCT YTTERSTA_KURSPAKETERING_SV FROM TEMP_REG_${unique_id}`
      );

      total += person_nummer.length;

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

      total_slapande += slapandeTot;

      //Lägg till för att använda i rechart

      result.push({
        program: programkod[i],
        data: sum_arr_sorted,
        dataPie: pie,
        program_namn: program_namn[0].YTTERSTA_KURSPAKETERING_SV,
      });
    }
    // Check if results have been returned
    let checkRes = utils.checkResultNotNull(result, res);
    if (checkRes != 0) {
      return checkRes;
    }

    res.status(200).send({
      data: result,
      total,
      total_slapande,
    });
  },

  getBetygsfordelning: async (req, res) => {
    let result2 = {};
    let result = new Array(req.query.programkod.length);
    for (let i = 0; i < result.length; ++i) {
      result[i] = await utils.sqlQuery(
        'SELECT UTBILDNING_KOD AS kurskod, COUNT(BETYGSVARDE) AS value, BETYGSVARDE AS betyg FROM io_studieresultat WHERE YTTERSTA_KURSPAKETERING_KOD=? GROUP BY UTBILDNING_KOD, BETYGSVARDE',
        req.query.programkod[i]
      );
    }

    for (let kurs in req.query.kurskod) {
      result2[req.query.kurskod[kurs]] = await utils.sqlQuery(
        'SELECT COUNT(BETYGSVARDE) AS value, BETYGSVARDE AS name FROM io_studieresultat WHERE UTBILDNING_KOD=? GROUP BY BETYGSVARDE',
        req.query.kurskod[kurs]
      );
    }

    res.status(200).send({
      programData: result,
      kursData: result2,
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
    let total_avhopp = 0;
    let total_kurser = 0;

    if (!Array.isArray(program)) {
      program = [program];
    }
    for (var i = 0; i < program.length; i++) {
      temp = await utils.sqlQuery(
        'SELECT UTBILDNING_KOD as kurskod, COUNT(AVBROTT_UTBILDNING) as avbrott, YTTERSTA_KURSPAKETERING_SV as namn FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD = ?  AND AVBROTT_UTBILDNING BETWEEN ? AND ? AND AVBROTT_UTBILDNING IS NOT NULL GROUP BY UTBILDNING_KOD,YTTERSTA_KURSPAKETERING_SV ORDER BY avbrott DESC',
        [program[i], start, slut]
      );

      //Calculate stats
      temp.map((val) => {
        total_avhopp += val.avbrott;
        total_kurser++;
      });
      result.push({
        program: program[i],
        program_namn: temp[0].namn,
        data: temp,
      });
    }

    // Check if results have been returned
    let checkRes = utils.checkResultNotNull(result, res);
    if (checkRes != 0) {
      return checkRes;
    }

    res.status(200).send({
      data: result,
      total_avhopp,
      total_kurser,
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
      kursKoder = [kursKoder];
    }
    let total_betyg = 0;
    let total_kurser = 0;
    //Hämta data för alla kurser och spara i result.
    for (var i = 0; i < kursKoder.length; i++) {
      result[i] = await utils.sqlQuery(
        //Quearyn för att hämta alla snittbetyg för kursens år och termin.
        'SELECT `UTBILDNING_KOD`,CONCAT(`AR`,`TERMIN`) AS PERIOD,((`ANDEL_INNEHALL_5`*5+`ANDEL_INNEHALL_4`*4+`ANDEL_INNEHALL_3`*3+`ANDEL_INNEHALL_2`*2+`ANDEL_INNEHALL_1`)/`ANTAL_SVAR`) AS "SNITT_BETYG" FROM EVALIUATE  WHERE UTBILDNING_KOD' +
          ` = "${kursKoder[i]}"` +
          ' ORDER BY UTBILDNING_KOD' +
          ` DESC`
      );

      result[i].map(() => {
        total_betyg++;
      });

      total_kurser++;
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
      total_betyg,
      total_kurser,
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

  getDagarPerKurs: async (req, res) => {
    let result = [];
    let startdatum = req.query.startdatum;
    let kurskod = req.query.kurskod;
    params = [kurskod, startdatum];

    // Check if kurskod has been passed as a parameter
    let checkParam = utils.checkParameters(params, res);
    if (checkParam != 0) {
      return checkParam;
    }
    let godkanda = [];
    let registrerade = [];
    let unique_id = uniqueID();
    //Skapar tillfälliga databaser för programmet för att minska belastning i senare loop
    let create_DB = await createTempDBdagar2(kurskod, unique_id);

    let dates = [];

    for (var i = 0; i < startdatum.length; i++) {
      //Returnerar antalet som registretas på kursen.
      registrerade = await utils.sqlQuery(
        `SELECT COUNT(PERSONNUMMER) as antalStudenter FROM TEMP_REG_${unique_id} WHERE STUDIEPERIOD_STARTDATUM  = ?`,
        [startdatum[i]]
      );

      //Array med datum man blev klar med kursen och antalet godkända.
      godkanda = await utils.sqlQuery(
        `SELECT COUNT(PERSONNUMMER) as antalStudenter, BESLUTSDATUM FROM TEMP_RES_${unique_id} WHERE UTBILDNINGSTILLFALLE_STARTDATUM  = ? GROUP BY BESLUTSDATUM`,
        [startdatum[i]]
      );

      var temp = [
        {
          antalDagar: 0,
          andelProcent: 0,
        },
      ]; //Resultat lagras temporärt i denna för varje kurs, pushas sen till result.

      //Loopar igenom och ändrar till antalet dagar och procent
      for (var j = 0; j < godkanda.length; j++) {
        temp.push({
          andelProcent: parseFloat(
            (
              (godkanda[j].antalStudenter / registrerade[0].antalStudenter) *
              100
            ).toFixed(2)
          ),
          antalDagar: daysBetweenDates(startdatum[i], godkanda[j].BESLUTSDATUM),
        });
      }

      //Summera ihop procenten.
      let sum = 0;
      let added_temp = temp.map((obj) => {
        return {
          antalDagar: obj.antalDagar,
          [startdatum[i]]: (sum += obj.andelProcent).toFixed(2),
        };
      });
      if (added_temp.length > 1) {
        result.push(...added_temp);
        dates.push(startdatum[i]);
      }
    }

    // Check if results have been returned
    /* let checkRes = utils.checkResultNotNull(result, res);
    if (checkRes != 0) {
      return checkRes;
    }*/

    res.status(200).send({
      data: result,
      dates,
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

    let counter = kurskod.length;
    let unique_id = uniqueID();

    //Om bara ett program är valt tolkar den som en string. Isåfall sätter vi counter till 1.
    if (!Array.isArray(kurskod)) {
      counter = 1;
      kurskod = [kurskod];
    }
    //Skapar tillfälliga databaser för programmet för att minska belastning i senare loop
    let create_DB = await createTempDBdagar(start, unique_id);

    let registrerade = [];
    let godkanda = [];
    let total_studenter = 0;

    //Loopa för alla kurser.
    for (var i = 0; i < counter; i++) {
      //Returnerar array med antalet som registretas på kursen och startdatumen.
      registrerade = await utils.sqlQuery(
        `SELECT COUNT(PERSONNUMMER) as antalStudenter, STUDIEPERIOD_STARTDATUM as startDatum FROM TEMP_REG_${unique_id} WHERE UTBILDNING_KOD= ? GROUP BY STUDIEPERIOD_STARTDATUM`,
        kurskod[i]
      );
      //Retunerar array med antalet godkända, startdatum och datumet man blev klar med kursen.
      godkanda = await utils.sqlQuery(
        `SELECT COUNT(PERSONNUMMER) as antalStudenter, UTBILDNINGSTILLFALLE_STARTDATUM as StartDatum, BESLUTSDATUM as SlutDatum FROM TEMP_RES_${unique_id} WHERE UTBILDNING_KOD= ?  GROUP BY UTBILDNINGSTILLFALLE_STARTDATUM, BESLUTSDATUM      `,
        [kurskod[i]]
      );

      var temp = [
        {
          antalDagar: 0,
          andelProcent: 0,
        },
      ]; //Resultat lagras temporärt i denna för varje kurs, pushas sen till result.
      var total = 0; //För att beräkna procent som är klar vid respektive slutdatum.
      for (var j = 0; j < registrerade.length; j++) {
        total += registrerade[j].antalStudenter;
      }
      total_studenter += total;
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
                (godkanda[k].antalStudenter / total) * 100
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
          [kurskod[i]]: (sum += obj.andelProcent).toFixed(2),
        };
      });

      //Push to same array
      result.push(...added_temp);

      // //Pusha alla resultat för kursen till result.
      // if (counter == 1) result.push({ kurs: kurskod, data: added_temp });
      // else result.push({ kurs: kurskod[i], data: added_temp });
    }

    // Check if results have been returned
    let checkRes = utils.checkResultNotNull(result, res);
    if (checkRes != 0) {
      return checkRes;
    }

    res.status(200).send({
      data: result,
      kurser: kurskod,
      total_studenter,
      total_kurser: counter,
    });
  },

  getOmtenta: async (req, res) => {
    let kurskod = req.query.kurskod;
    let result = {};
    let result2 = {};
    let result3 = {};
    for (let i = 0; i < kurskod.length; ++i) {
      result[kurskod[i]] = await utils.sqlQuery(
        'SELECT PERSONNUMMER AS persnr, COUNT(BETYGSVARDE) AS value FROM io_studieresultat WHERE UTBILDNING_KOD=? AND BETYGGRAD_EN="Fail" AND MODUL_KOD="TEN1" GROUP BY PERSONNUMMER',
        kurskod[i]
      );

      result2[kurskod[i]] = await utils.sqlQuery(
        'SELECT COUNT(DISTINCT(PERSONNUMMER)) AS value FROM io_studieresultat WHERE UTBILDNING_KOD=? AND MODUL_KOD="TEN1"',
        kurskod[i]
      );

      result3[kurskod[i]] = await utils.sqlQuery(
        'SELECT PERSONNUMMER AS persnr FROM io_studieresultat WHERE UTBILDNING_KOD=? AND BETYGGRAD_EN!="Fail" AND MODUL_KOD="TEN1" GROUP BY PERSONNUMMER',
        kurskod[i]
      );
    }

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
    `CREATE TEMPORARY TABLE TEMP_REG_${unique_id} AS SELECT YTTERSTA_KURSPAKETERING_SV,UTBILDNING_KOD,PERSONNUMMER, OMFATTNINGVARDE FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD=? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM=? AND STUDIEPERIOD_STARTDATUM >= ? AND STUDIEPERIOD_SLUTDATUM <= "2022-02-23" AND AVBROTT_YTTERSTAKURSPAKETERING IS NULL `,
    [programkod, start_datum, start_datum]
  );
  //Skapa en temporär databas som innehåller resultat:
  //alla personnummer som fått ett resultat på en kurs och HP för kursen.
  let create_res = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_RES_${unique_id} AS SELECT UTBILDNING_KOD,AVSER_HEL_KURS,PERSONNUMMER, OMFATTNINGVARDE FROM IO_STUDIERESULTAT WHERE YTTERSTA_KURSPAKETERING_KOD=? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM=? AND UTBILDNINGSTILLFALLE_STARTDATUM >= ? AND AVBROTT_YTTERSTAKURSPAKETERING IS NULL`,
    [programkod, start_datum, start_datum]
  );
};

let createTempDBdagar = async (start, unique_id) => {
  //Skapa en temporär databas som innehåller registrering:
  //Alla personnummer med tillhörande startdatum för alla kurser.
  let create_reg_dagar = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_REG_${unique_id} AS SELECT PERSONNUMMER, STUDIEPERIOD_STARTDATUM, UTBILDNING_KOD FROM IO_REGISTRERING WHERE STUDIEPERIOD_STARTDATUM >= ? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ?`,
    [start, start]
  );

  //Skapa en temporär databas som innehåller resultat:
  //Alla personnummer som fått ett godkänt i kurser med tillhörande start och slutdatum.
  let create_res_dagar = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_RES_${unique_id} AS SELECT PERSONNUMMER, UTBILDNINGSTILLFALLE_STARTDATUM, BESLUTSDATUM, UTBILDNING_KOD FROM IO_STUDIERESULTAT WHERE AVSER_HEL_KURS=1 AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = ? AND BESLUTSDATUM >= ?`,
    [start, start]
  );
};

let createTempDBdagar2 = async (kurskod, unique_id) => {
  //Skapa en temporär databas som innehåller registrering:
  //Alla personnummer med tillhörande startdatum för alla kurser.
  let create_reg_dagar2 = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_REG_${unique_id} AS SELECT PERSONNUMMER, STUDIEPERIOD_STARTDATUM FROM IO_REGISTRERING WHERE UTBILDNING_KOD = ?`,
    [kurskod]
  );

  //Skapa en temporär databas som innehåller resultat:
  //Alla personnummer som fått ett godkänt i kurser med tillhörande start och slutdatum.
  let create_res_dagar2 = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_RES_${unique_id} AS SELECT PERSONNUMMER, UTBILDNINGSTILLFALLE_STARTDATUM, BESLUTSDATUM FROM IO_STUDIERESULTAT WHERE AVSER_HEL_KURS=1 AND UTBILDNING_KOD = ?`,
    [kurskod]
  );
};

function uniqueID() {
  return Math.floor(Math.random() * Date.now());
}

let getNameFromProgram = async (programkod) => {
  let result = await utils.sqlQuery(`SELECT DISTINCT(YTTERSTA_)`, programkod);
};
