var Lab = require('lab');
var lab = exports.lab = Lab.script();
var restfs = require('../fileserver.js');
var express = require('express');
var server = express();
restfs(server);

lab.experiment('create tests', function () {
  lab.test('try to create without express app', function (done) {
    try {
      restfs();
    } catch (err) {
      if (err) {
        return done();
      }
      return (err);
    }
  });
});