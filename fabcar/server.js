var express = require('express'),
    app = express(),
    port = process.env.PORT || 3000,
    bodyParser = require('body-parser');

// mongoose instance connection url connection


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('./'));


var routes = require('./web/routes'); //importing route
routes(app); //register the route


app.listen(port);


console.log('API server is running nuts on: ' + port);