var fileserver = require('./fileserver.js');

function middleware () {
  app.set('etag', 'strong');
  app.use(require('express-domain-middleware'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(morgan('combined', {
    skip: function () { return process.env.LOG !== 'true'; }
  }));
  app.use(fileserver);
  app.use(function (err, req, res, next)  {
    error('uncaught error', err.stack);
    var outErr = {
      message: err.message,
      stack: err.stack
    };
    res.status(500).send(outErr);
  });
}

module.exports = middleware;
