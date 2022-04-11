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
    let program = req.query.program;
    let start = req.query.startDatum;
    let slut = req.query.slutDatum;
    result = await utils.sqlQuery(
      'SELECT UTBILDNING_KOD as kurskod, COUNT(AVBROTT_UTBILDNING) as avbrott FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD = ?  AND AVBROTT_UTBILDNING BETWEEN ? AND ? AND AVBROTT_UTBILDNING IS NOT NULL GROUP BY UTBILDNING_KOD ORDER BY avbrott DESC',
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
    let limit = req.query.limit;
    result = await utils.sqlQuery(
      //Quearyn har för tillfället en DESC LIMIT på 10
      'SELECT `UTBILDNING_KOD`,CONCAT(`AR`,`TERMIN`) AS PERIOD,((`ANDEL_INNEHALL_5`*5+`ANDEL_INNEHALL_4`*4+`ANDEL_INNEHALL_3`*3+`ANDEL_INNEHALL_2`*2+`ANDEL_INNEHALL_1`)/`ANTAL_SVAR`) AS "SNITT_BETYG" FROM EVALIUATE ORDER BY UTBILDNING_KOD' +
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

    let programKod = req.query.program;
    let result = [];

    quary =
      'SELECT DISTINCT `UTBILDNING_KOD`,`UTBILDNING_SV` FROM `IO_REGISTRERING` WHERE `YTTERSTA_KURSPAKETERING_KOD` = ? AND UTBILDNING_KOD IS NOT NULL';

    result = await utils.sqlQuery(quary, programKod);
    res.status(200).send({
      data: result,
    });
  },

  getProgramKoder: async (req, res) => {
    //Hämtar alla programkoder i DT
    let result = [];

    result = await utils.sqlQuery(
      'SELECT YTTERSTA_KURSPAKETERING_KOD,ANY_VALUE(YTTERSTA_KURSPAKETERING_SV) AS YTTERSTA_KURSPAKETERING_SV FROM IO_REGISTRERING GROUP BY YTTERSTA_KURSPAKETERING_KOD'
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

    res.status(200).send({
      data: sum_arr_sorted,
    });
  },

  getHP: async (req, res) => {
    let programkod = req.query.program;
    let start_datum = req.query.startdatum;
    let unique_id = uniqueID();

    let create_DB = await createTempDB(programkod, start_datum, unique_id);
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

    percent = Math.round((under_limit / person_nummer.length) * 100); //Omvandla till procent.
    console.log(
      'Totalt är ' +
        under_limit +
        ' av ' +
        person_nummer.length +
        ' studenter inte berättigade CSN, vilket motsvarar ca ' +
        percent +
        '%'
    );

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

    res.status(200).send({
      data: sort_HP,
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

/**
 *
 * Funktion för att hämta startdatum för ett program
 * @returns start datum
 */
let getProgramStartDatum = async (programkod) => {
  let start_dates = await utils.sqlQuery(
    'SELECT DISTINCT YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM FROM `IO_REGISTRERING` WHERE YTTERSTA_KURSPAKETERING_KOD=? ORDER BY YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM DESC',
    programkod
  );

  return start_dates;
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
