/**
 * Contains functions that are used by several functions in the handlers files.
 */

var db = require('./connectDB.js');

module.exports = {
  // Make a query to the database
  // Returns: - error if error occurrs
  //          - the response from the database if requests was successfull
  sqlQuery: (query, params) => {
    return new Promise((resolve, reject) => {
      db.query(
        {
          sql: query,
          values: params,
        },
        (error, result) => {
          if (error) {
            reject(error);
          }
          resolve(result);
        }
      );
    });
  },
  // Checks if parameters have been sent in with query
  // Takes an array params with all parameters to be checked. Loops over each parameter and checks if it exists.
  // Returns: - status code 400 if one of the parameters have no value
  //          - 0 if all parameters have values
  checkParameters: (params, res) => {
    let resolve = 0;
    params.forEach((element) => {
      if (!element) {
        resolve = res.status(400).json({
          success: 0,
          data: 'Must submit correct parameters to query.',
        });
      }
    });
    return resolve;
  },

  // Checks if the result of a database query is null
  // Returns: - status code 404 if result is empty
  //          - 0 if result is not empty
  checkResultNotNull: (result, res) => {
    if (!result) {
      return res.status(404).json({
        success: 0,
        data: 'No such entry in the database.',
      });
    } else return 0;
  },
};
