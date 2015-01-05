// fileserver
var bodyParser = require('body-parser');
var fileDriver = require('./fsDriver.js');
var url = require('url');
var mime = require('mime');
var path = require('path');
var mw = require('dat-middleware');
var flow = require('middleware-flow');
var morgan = require('morgan');
var error = require('debug')('rest-fs:fileserver');

var fileserver = function(app) {
  if (!app) {
    throw new Error('express app required');
  }

  app.use(require('express-domain-middleware'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));
  app.use(morgan('combined', {
    skip: function () { return process.env.LOG !== 'true'; }
  }));
  app.get(/^\/.+\/$/, getDir);
  app.get(/^\/.+[^\/]$/, getFile);
  app.post("/*", postFileOrDir);
  app.put("/*", putFileOrDir);
  app.delete(/^\/.+\/$/, delDir);
  app.delete(/^\/.+[^\/]$/, delFile);
  app.use(function (err, req, res, next)  {
    error('uncaught error', err.stack);
    var outErr = {
      message: err.message,
      stack: err.stack
    };
    res.status(500).send(outErr);
  });
  return app;
};

/* GET
  /path/to/dir/
  list contents of directory

  *optional*
  ?recursive = list recursively default false

  return: list of files/dirs
  res.body = [
    {
      "fullFilePath"
    }, ...
  ]
*/
var getDir = function (req, res, next) {
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  var isRecursive = req.query.recursive || "false";

  var handList = function (err, files) {
    if (err && err.code === 'ENOTDIR') {
      // this this is a file, redirect to file path
      var originalUrl = url.parse(req.originalUrl);
      originalUrl.pathname = originalUrl.pathname.substr(0, originalUrl.pathname.length - 1);
      var target = url.format(originalUrl);
      res.statusCode = 303;
      res.setHeader('Location', target);
      return res.end('Redirecting to ' + target);
    }
    if (files) {
      for (var i = files.length - 1; i >= 0; i--) {
        files[i] = formatOutData(req, files[i]);
      }
    }
    sendCode(200, req, res, next, files)(err);
  };

  if (isRecursive === "true") {
    return fileDriver.listAll(dirPath, handList);
  } else {
    return fileDriver.list(dirPath, handList);
  }
};

/* GET
  /path/to/file
  return contents of file
  if dir, redirect to dir path

  *optional*
  ?encoding = default utf8

  return: data of file
  res.body = {"content of specified file"}
*/
var getFile = function (req, res, next) {
  var filePath = decodeURI(url.parse(req.url).pathname);
  var encoding = req.query.encoding || 'utf8';
  fileDriver.readFile(filePath, encoding, function(err, data) {
    if (err && err.code === 'EISDIR') {
      // this this is a dir, redirect to dir path
      var originalUrl = url.parse(req.originalUrl);
      originalUrl.pathname += '/';
      var target = url.format(originalUrl);
      res.statusCode = 303;
      res.setHeader('Location', target);
      return res.end('Redirecting to ' + target);
    }

    res.set('content-type', mime.lookup(filePath));
    sendCode(200, req, res, next, data)(err);
  });
};

/* POST
  /path/to/file/or/dir
  creates or overwrites file
  creates dir if it does not exisit.
  renames or moves file if newPath exists
  *optional*
  body.newPath = if exist, move/rename file to this location.
  body.clobber = if true will overwrite dest files (default false)
  body.mkdirp = if true will create path to new location (default false)

  body.mode = permissons of file (defaults: file 438(0666) dir 511(0777))
  body.encoding = default utf8

  returns: modified resource
  res.body = {
    "fullFilePath" or dir
  }
*/
var postFileOrDir = function (req, res, next) {
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  var isDir = dirPath.substr(-1) == '/';
  var options = {};
  var isJson = false;
  if (typeof req.headers['content-type'] === 'string') {
    isJson = ~req.headers['content-type'].indexOf('application/json') === -1 ? true : false;
  }
  // move/rename if newPath exists
  if (req.body.newPath) {
    options.clobber = req.body.clobber || false;
    options.mkdirp = req.body.mkdirp || false;
    return fileDriver.move(dirPath, req.body.newPath, options,
      sendCode(200, req, res, next, formatOutData(req, req.body.newPath)));
  }

  if (isDir) {
    var mode = req.body.mode || 511;
    return fileDriver.mkdir(dirPath, mode,
      sendCode(201, req, res, next, formatOutData(req, dirPath)));
  }

  if (!isJson) {
    // default is to not clobber
    options.encoding = req.query.encoding  || 'utf8';
    options.mode = req.query.mode || 438;
    options.flags =  req.query.clobber === 'true' ? 'w' : 'wx';

    return fileDriver.writeFileStream(dirPath, req, options,
      sendCode(201, req, res, next, formatOutData(req, dirPath)));
  }

  options.encoding = req.body.encoding  || 'utf8';
  options.mode = req.body.mode || 438;
  var data = req.body.content || '';
  fileDriver.writeFile(dirPath, data, options,
    sendCode(201, req, res, next, formatOutData(req, dirPath)));
};

/* PUT
  /path/to/file/or/dir
  make file or dir

  *optional*
  body.mode = permissons of file (438 default 0666 octal)
  body.encoding = default utf8

  returns: modified resource
  res.body = {
    "fullFilePath"
  }
*/
var putFileOrDir = function (req, res, next) {
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  var isDir = dirPath.substr(-1) == '/';
  var options = {};

  if (isDir) {
    var mode = req.body.mode || 511;
    fileDriver.mkdir(dirPath, mode,
      sendCode(201, req, res, next, formatOutData(req, dirPath)));
  } else {
    options.encoding = req.body.encoding  || 'utf8';
    options.mode = req.body.mode  || 438;
    var data = req.body.content || '';
    fileDriver.writeFile(dirPath, data, options,
      sendCode(201, req, res, next, formatOutData(req, dirPath)));
  }
};

/* DEL
  /path/to/dir/
  deletes dir
  *optional*
  body.clobber = will remove non-empty dir (defaut: false)

  return:
  res.body = {}
*/
var delDir = function (req, res, next) {
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  var clobber = req.body.clobber  || false;
  fileDriver.rmdir(dirPath, clobber, sendCode(200, req, res, next, {}));
};

/* DEL
  /path/to/file
  deletes file

  return:
  res.body = {}
*/
var delFile = function (req, res, next) {
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  fileDriver.unlink(dirPath, sendCode(200, req, res, next, {}));
};

// Helpers

// formats out data based on client spec.
var formatOutData = function (req, filepath) {
  var out = filepath;
  if (typeof req.modifyOut === 'function') {
    out = req.modifyOut(out);
  }
  return out;
};

var sendCode = function(code, req, res, next, out) {
  return function (err) {
    if (err) {
      error('ERROR', req.url, err);
      code = 500;
      out = {
        errno: err.errno,
        code: err.code,
        path: err.path,
        message: err.message,
        stack: err.stack
      };

      if (err.code === 'ENOENT') {
        code = 404;
      } if (err.code === 'EPERM') {
        code = 403;
      } if (err.code === 'ENOTDIR' ||
            err.code === 'EISDIR') {
        code = 400;
      } if (err.code === 'ENOTEMPTY' ||
            err.code === 'EEXIST' ||
            err.code === 'EINVAL') {
        code = 409;
      }
    }
    res.status(code).send(out);
  };
};

module.exports = fileserver;
