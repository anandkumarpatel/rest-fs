var Lab = require('lab');
var restfs = require('../fileserver.js');

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
});