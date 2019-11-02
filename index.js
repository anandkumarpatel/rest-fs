var express = require('express');
var app = express();
var fileserver = require('./fileserver.js');

fileserver(app, {fs: require('fs'), basePath: ''});

app.listen(3000);