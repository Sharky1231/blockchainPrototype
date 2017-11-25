const pg = require('pg');
const conString = "pg://postgres:tomas@localhost:5432/healthcare";
const client = new pg.Client(conString);
client.connect();

let response = {
    data: [],
    messages: [],
    err: [],
    token: ''
};


exports.getData = function (req, res) {
    return new Promise((resolve, reject) => {
        let patientId = req.params.patientId;
        let token = req.headers.authorization;

        // if (!token) {
        //     resolve('No token found');
        //     throw new Error('No token found!');
        // }


        client.query("SELECT * from patients WHERE cpr='" +patientId +"'", function (err, result) {
            if(result && result.rowCount > 0)
                response.data.push(result.rows[0]);
            else
                response.err.push("Patient not found!");

            resolve(res.json(response));
        });


        // var con = mysql.createConnection({
        //     host: "localhost",
        //     port: 5432,
        //     user: "postgres",
        //     password: "tomas",
        //     database: 'healthcare'
        // });
        //
        // con.connect(function (err) {
        //     if (err) throw err;
        //     console.log("Connected!");
        //     con.query("SELECT * from patients where id='" + patientId + "'", function (err, result) {
        //         if (err) throw err;
        //
        //         resolve(res.json(result));
        //         console.log("Result: " + result);
        //     });
        // });
    });
};