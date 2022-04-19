/**
 * Functions for handling request
 * Calls sqlQuery function from utils and gets data from database
 */

const utils = require('../setup/utils');

module.exports = {
  getBetyg: async (req, res) => {
    let result = [];
    result = await utils.sqlQuery(
      'SELECT BETYGSVARDE AS betyg, COUNT(BETYGSVARDE) AS antal FROM IO_STUDIERESULTAT WHERE UTBILDNING_KOD="TNG033" GROUP BY BETYGSVARDE'
    );

    res.status(200).send({
      data: result,
    });
  },

  getAvbrott: async (req, res) => {
    let result = [];

    if (req.query.program != undefined) {
      let program = req.query.program;
      let start = req.query.startDatum;
      let slut = req.query.slutDatum;
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
    }

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
      'SELECT COUNT(PERSONNUMMER) as antal FROM `IO_REGISTRERING` WHERE UTBILDNING_KOD= ?  AND STUDIEPERIOD_STARTDATUM = ? GROUP BY UTBILDNING_KOD',
      [kurskod, startdatum]
    );

    //Array med datum man blev klar med kursen och antalet godkända.
    let godkanda_personer = await utils.sqlQuery(
      'SELECT COUNT(PERSONNUMMER) as antal_personer, BESLUTSDATUM FROM `IO_STUDIERESULTAT` WHERE AVSER_HEL_KURS=1 AND UTBILDNING_KOD= ?  AND UTBILDNINGSTILLFALLE_STARTDATUM = ? GROUP BY UTBILDNING_KOD, BESLUTSDATUM',
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

  //Hämtar kuser med tillhörande år/termin. Summerar ihop kursutväerderingsbetygen och tar fram ett snittbetyg (SNITT_BETYG).
  //Tar in antalet som parameter
  getKursUtvarderingsBetyg: async (req, res) => {
    let result = [];

    //Kolla om ingen kurs är vald, vi vill inte att programmet ska krascha.
    if (req.query.kurskod != undefined) {
      let kursKoder = req.query.kurskod;
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
    }
    res.status(200).send({
      data: result,
    });
  },

  getKurserFranProgram: async (req, res) => {
    //Hämtar alla kurser som tillhör de valda programmen
    let result = [];

    if (req.query.program != undefined) {
      let programKod = req.query.program;

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
    }
    res.status(200).send({
      data: result,
    });
  },

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

  getProgramStartDatum: async (req, res) => {
    let result = [];
    let programkod = req.query.program;

    if (programkod != undefined) {
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
    }

    res.status(200).send({
      data: result,
    });
  },

  getStudenterMedSlapande: async (req, res) => {
    let programkod = req.query.program;
    let start_datum = req.query.startdatum;

    let unique_id = uniqueID();
    //Skapar tillfälliga databaser för programmet för att minska belastning i senare loop
    let create_DB = await createTempDB(programkod, start_datum, unique_id);

    let person_nummer = await utils.sqlQuery(
      `SELECT DISTINCT PERSONNUMMER FROM TEMP_REG_${unique_id}`
    );

    let res_arr = [];
    let timer = 0;

    //Går igenom personer och beräknar "borde klarat" och "har klarat"
    for (var i = 0; i < person_nummer.length; i++) {
      let actual_completed = await utils.sqlQuery(
        `SELECT COUNT(DISTINCT UTBILDNING_KOD) as antal FROM TEMP_RES_${unique_id} WHERE AVSER_HEL_KURS = 1 AND PERSONNUMMER = ?`,
        person_nummer[i].PERSONNUMMER
      );

      let should_be_completed = await utils.sqlQuery(
        `SELECT COUNT(DISTINCT UTBILDNING_KOD) as antal FROM TEMP_REG_${unique_id} WHERE PERSONNUMMER = ?`,
        person_nummer[i].PERSONNUMMER
      );

      let diff = should_be_completed[0].antal - actual_completed[0].antal;

      res_arr[i] = diff;

      //Laddningslog för debugging
      process.stdout.write(
        'Loading ' + timer + '/' + person_nummer.length + '\r'
      );
      timer++;
    }

    //Formattererar om datan med properties
    const obj = [];
    for (var i = 0; i < res_arr.length; i++) {
      obj.push({
        name: res_arr[i],
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
    var slapandeTot = person_nummer.length;
    var noSlapandeTot = 0;

    //Om någon inte har släpande kurser så ändras värdena.
    if (sum_arr_sorted[0].name == 0) {
      slapandeTot = person_nummer.length - sum_arr_sorted[0].value;
      noSlapandeTot = sum_arr_sorted[0].value;
    }

    //Lägg till för att använda i PieChart
    let pie = [];
    pie.push({ name: 'Inga släpande', value: noSlapandeTot });
    pie.push({ name: 'Släpande', value: slapandeTot });

    res.status(200).send({
      data: sum_arr_sorted,
      data2: pie,
    });
  },

  getHP: async (req, res) => {
    let result = [];
    if (req.query.program != undefined) {
      let programkod = req.query.program;
      let start_datum = req.query.startdatum;
      var counter = programkod.length;

      //Om bara ett program är valt tolkar den som en string. Isåfall sätter vi counter till 1.
      if (!Array.isArray(programkod)) {
        counter = 1;
      }
      for (var j = 0; j < counter; j++) {
        let unique_id = uniqueID();
        if (counter == 1) {
          let create_DB = await createTempDB(
            programkod,
            start_datum,
            unique_id
          );
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
    }

    res.status(200).send({
      data: result,
    });
  },

  getAntalStudenter: async (req, res) => {
    let antalStudenter = [];

    antalStudenter = await utils.sqlQuery(
      'SELECT COUNT(DISTINCT PERSONNUMMER) as antal FROM `IO_REGISTRERING` WHERE UTBILDNING_KOD = "TND004" AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM = "2015-08-17"'
    );

    res.status(200).send({
      data: antalStudenter,
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

let createTempDBDates = async (unique_id) => {
  //Skapa en temporär databas för att hämta alla startdatum för program
  let create_reg_dates = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_REG_DATES_${unique_id} AS SELECT DISTINCT YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM, YTTERSTA_KURSPAKETERING_KOD FROM IO_REGISTRERING`
  );
};

function uniqueID() {
  return Math.floor(Math.random() * Date.now());
}

let createTempDBCourses = async (unique_id) => {
  //Skapa en temporär databas för att hämta alla kurser för program
  let create_reg_courses = await utils.sqlQuery(
    `CREATE TEMPORARY TABLE TEMP_REG_COURSES_${unique_id} AS SELECT  YTTERSTA_KURSPAKETERING_KOD, UTBILDNING_SV, UTBILDNING_KOD FROM IO_REGISTRERING`
  );
};

function uniqueID() {
  return Math.floor(Math.random() * Date.now());
}
