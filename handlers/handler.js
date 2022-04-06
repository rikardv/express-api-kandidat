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

  getStudenterUtanHP: async (req, res) => {
    let programkod = req.query.program;
    let start_datum = req.query.startdatum;

    //Skapa en temporär databas som innehåller registrering:
    //alla personnummer som registerats på en kurs och HP för kursen samt antalet som gjort avbrott på programmet.
    let create_reg = await utils.sqlQuery(
      'CREATE TABLE TEMP_REG AS SELECT UTBILDNING_KOD,PERSONNUMMER, AVBROTT_YTTERSTAKURSPAKETERING, OMFATTNINGVARDE FROM IO_REGISTRERING WHERE YTTERSTA_KURSPAKETERING_KOD=? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM=? AND STUDIEPERIOD_STARTDATUM >= ? AND STUDIEPERIOD_SLUTDATUM <= "2022-02-23" ',
      [programkod, start_datum, start_datum]
    );
    //Skapa en temporär databas som innehåller resultat:
    //alla personnummer som fått ett resultat på en kurs och HP för kursen.
    let create_res = await utils.sqlQuery(
      'CREATE TABLE TEMP_RES AS SELECT UTBILDNING_KOD,AVSER_HEL_KURS,PERSONNUMMER, OMFATTNINGVARDE FROM IO_STUDIERESULTAT WHERE YTTERSTA_KURSPAKETERING_KOD=? AND YTTERSTA_KURSPAKETERINGSTILLFALLE_STARTDATUM=? AND UTBILDNINGSTILLFALLE_STARTDATUM >= ?',
      [programkod, start_datum, start_datum]
    );

    //beräkna alla unika personnummer från den temporära registreringsdatabasen.
    let person_nummer = await utils.sqlQuery(
      'SELECT DISTINCT PERSONNUMMER FROM TEMP_REG'
    );

    //beräkna alla unika personnummer som gjort avbrott från programmet från den temporära registreringsdatabasen.
    let total_break_persons = await utils.sqlQuery(
      'SELECT COUNT(DISTINCT PERSONNUMMER) as count FROM TEMP_REG WHERE AVBROTT_YTTERSTAKURSPAKETERING !="NULL"'
    );

    let limit_procent = 0.625; //62.5% HP krävs för att få CSN.
    let limit = 0; //nytt värde för varje personnummer, används för att jämföra antal HP med CSN-gränsen.
    let HP_tot = []; //för att lagra antalet HP varje person läst.
    let HP_completed_tot = []; //för att lagra antalet HP varje person klarat.
    let res_arr = []; //används för att skicka resultat till React.
    let under_limit = 0; //counter för antalet personer som är under CSN-gränsen.

    //Loopa igenom för samtliga personnummer.
    for (var i = 0; i < person_nummer.length; i++) {
      //Hämta antal HP en person avklarat.
      let completed_HP = await utils.sqlQuery(
        'SELECT OMFATTNINGVARDE as HP_G FROM TEMP_RES WHERE AVSER_HEL_KURS = 1 AND PERSONNUMMER = ?',
        person_nummer[i].PERSONNUMMER
      );

      //Hämta antal HP en person läst.
      let HP = await utils.sqlQuery(
        'SELECT OMFATTNINGVARDE as HP FROM TEMP_REG WHERE PERSONNUMMER = ?',
        person_nummer[i].PERSONNUMMER
      );

      //Undviker "bugg"
      if (completed_HP.length != 0) {
        HP_completed_tot[i] = completed_HP.length * completed_HP[0].HP_G; //summera alla HP en person avklarat (EJ SÄKER på att det funkar om en kurs har annat HP värde!).
      } else HP_completed_tot[i] = 0; //Om man inte klarat en enda kurs

      HP_tot[i] = HP.length * HP[0].HP; //Summerar alla HP en person läst (EJ SÄKER på att det funkar om en kurs har annat HP värde!)
      limit = limit_procent * HP_tot[i]; //beräkna CSN-gränsen

      //Jämför avklarade HP med CSN-gränsen.
      if (limit > HP_completed_tot[i]) {
        under_limit++; //Om man är under gränsen ökar antalet personer som är under gränsen.
      }

      //används för att skicka resultat till React. (ÄNDRAS SEN)
      res_arr[i] = {
        name: person_nummer[i].PERSONNUMMER,
        expected: HP_tot[i],
        actual: HP_completed_tot[i],
        required: limit,
      };
    }

    let total_under_limit = under_limit - total_break_persons[0].count; //Ta bort alla personer som hoppat av programmet från totalt
    let studentsLeft = person_nummer.length - total_break_persons[0].count; //Ta bort alla personer som hoppat av programmet från totalt
    let percent = Math.round((total_under_limit / studentsLeft) * 100); //Omvandla till procent.
    console.log(
      'Totalt är ' +
        total_under_limit +
        ' av ' +
        studentsLeft +
        ' studenter inte berättigade CSN. Vilket motsvarar ' +
        percent +
        '%'
    );

    //Ta bort de temporära databaserna.
    let drop_temp_res = await utils.sqlQuery('DROP TABLE TEMP_RES');
    let drop_temp_reg = await utils.sqlQuery('DROP TABLE TEMP_REG');

    res.status(200).send({
      data: res_arr,
    });
  },
};
