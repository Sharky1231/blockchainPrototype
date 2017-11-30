const pg = require('pg');
let serverCtrl = require('./serverController');
const conString = "pg://postgres:tomas@localhost:5432/healthcare";
const client = new pg.Client(conString);
client.connect();

let response = {};

exports.getData = function (req, res) {
    return new Promise((resolve, reject) => {
        let patientId = req.params.patientId;
        let token = req.headers.authorization;

        initResponse();

        if (!serverCtrl.isValidToken(req)) {
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

exports.verifyActorInDB = function (req){
    return new Promise((resolve, reject) => {
        let userId = req.params.userId;

        client.query("SELECT * FROM actors WHERE id='" +userId +"'", function (err, result) {
            if(result && result.rowCount > 0)
                resolve(result.rows[0]);
            else {
                resolve(false);
            }
        });

    });
};

exports.updateData = function (jsonData) {
    return new Promise((resolve, reject) => {
        let cpr = jsonData.cpr;
        let address = jsonData.address;
        let email = jsonData.email;

        client.query("UPDATE patients SET email='"+ email +"' , address='"+ address +"' WHERE cpr='"+ cpr +"'", function (err, result) {
            resolve(true);
        });

    });
};

let initResponse = function () {
    response = {
        data: [],
        messages: [],
        err: [],
        token: ''
    };
};