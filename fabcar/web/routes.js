'use strict';
module.exports = function(app) {
    let svCtrl = require('./serverController');
    let dbCtrl = require('./databaseController');

    app.route('/')
        .get(svCtrl.showIndex);

    app.route('/enrollAdmin')
        .get(svCtrl.enrollAdmin);

    app.route('/enrollUser/:userId/:hashedPass')
        .get(svCtrl.enrollUser);

    app.route('/login/:userId/:hashedPass')
        .get(svCtrl.loginUser);

    app.route('/query/:userId/:functionName/:parameters')
        .get(svCtrl.queryMethod);

    app.route('/query/:userId/:functionName/')
        .get(svCtrl.queryMethodNoParameters);

    app.route('/invoke/:userId/:functionName/:parameters')
        .get(svCtrl.invoke);

    app.route('/getData/:patientId')
        .get(dbCtrl.getData)
};
