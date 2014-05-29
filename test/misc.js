var Lab = require('lab');
var restfs = require('../fileserver.js');
var express = require('express');
var server = express();
restfs(server);

Lab.experiment('create tests', function () {
  Lab.test('try to create without express app', function (done) {
    try {
      restfs();
    } catch (err) {
      if (err) {
        return done();
      }
      return (err);
    }
  });
  Lab.test('test invalid setModifyOut', function (done) {
    try {
      server.setModifyOut("fake");
    } catch (err) {
      done();
    }
  });
});