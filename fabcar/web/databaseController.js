const pg = require('pg');
const conString = "pg://postgres:tomas@localhost:5432/healthcare";
const client = new pg.Client(conString);
client.connect();

let response = {};

exports.getData = function (req, res) {
    return new Promise((resolve, reject) => {
        let patientId = req.params.patientId;
        let token = req.headers.authorization;

        initResponse();

        if (!token) {
            response.err.push('No token found!');
            resolve(res.json(response));
            throw new Error('No token found!');
        }

        response.token = token;

        client.query("SELECT * FROM patients WHERE cpr='" +patientId +"'", function (err, result) {
            if(result && result.rowCount > 0)
                response.data.push(result.rows[0]);
            else {
                response.err.push("Patient not found!");
                resolve(res.json(response));
            }

            client.query("SELECT * FROM prescriptions WHERE patientid='" +patientId +"'", function (err, result) {
                if(result && result.rowCount > 0)
                    response.data.push(result.rows);

                resolve(res.json(response));
            });

        });
    });
};

var initResponse = function () {
    response = {
        data: [],
        messages: [],
        err: [],
        token: ''
    };
};