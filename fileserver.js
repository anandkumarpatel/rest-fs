// fileserver
var bodyParser = require('body-parser');
var fileDriver = require('./fsDriver.js');
var url = require('url');
var mime = require('mime');

var fileserver = function(app) {
  if (!app) {
    throw new Error('express app required');
  }

  app.use(bodyParser());
  app.get("/*/", getDir);
  app.get("/*", getFile);
  app.post("/*", postFileOrDir);
  app.put("/*", putFileOrDir);
  app.del("/*/", delDir);
  app.del("/*", delFile);
  app.use(function (err, req, res, next)  {
    res.send(500, err);
  });
  return app;
};

/* GET
  /path/to/dir/
  list contents of directory
  
  *optional*
  ?recursive = list recursively default false
  
  return:
  [
    {
      "name" : "file1", // name of dir or file
      "path" : "/path/to/file", // path to dir or file 
      "dir" : false // true if directory
    },
  ]
*/
var getDir = function (req, res, next) { 
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  var isRecursive = req.query.recursive || "false";

  var handList = function (err, files) {
    if (err) {
      // this this is a file, redirect to file path
      if (err.code === 'ENOTDIR') {
        var originalUrl = url.parse(req.originalUrl);
        originalUrl.pathname = originalUrl.pathname.substr(0, originalUrl.pathname.length - 1);
        var target = url.format(originalUrl);
        res.statusCode = 303;
        res.setHeader('Location', target);
        res.end('Redirecting to ' + target);
        return;
      }
      return next(err);
    }
    res.json(files);
  };

  if (isRecursive === "true") {
    return fileDriver.listAll(dirPath, false, handList);
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

  return:
  content of specified file
*/
var getFile = function (req, res, next) { 
  var filePath = decodeURI(url.parse(req.url).pathname);
  var encoding = req.query.encoding || 'utf8';
  fileDriver.readFile(filePath, encoding, function(err, data) {
    if (err) {
      // this this is a dir, redirect to dir path
      if (err.code === 'EISDIR') {
        var originalUrl = url.parse(req.originalUrl);
        originalUrl.pathname += '/';
        var target = url.format(originalUrl);
        res.statusCode = 303;
        res.setHeader('Location', target);
        res.end('Redirecting to ' + target);
        return;
      }
      next(err);
      return;
    }

    res.set('Content-Type', mime.lookup(filePath));
    res.send(200, data);
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
  body.mkdirp = if true will create path to new locatiin (default false)

  body.mode = permissons of file (defaults: file 438(0666) dir 511(0777))
  body.encoding = default utf8

  returns: modified resource
  {
    "name" : "file1", // name of dir or file
    "path" : "/path/to/file", // path to dir or file 
    "dir" : false // true if directory
  }
*/
var postFileOrDir = function (req, res, next) { 
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  var isDir = dirPath.substr(-1) == '/';
  var options = {};
  // move/rename if newPath exists
  if (req.body.newPath) {
    options.clobber = req.body.clobber || false;
    options.mkdirp = req.body.mkdirp || false;
    fileDriver.move(dirPath, req.body.newPath, options, 
      send200(req, res, next, formatOutData(dirPath, isDir)));
    return;
  }

  if (isDir) {
    var mode = req.body.mode || 511;
    fileDriver.mkdir(dirPath, mode, 
      send200(req, res, next, formatOutData(dirPath, isDir)));
  } else {
    options.encoding = req.body.encoding  || 'utf8';
    options.mode = req.body.mode  || 438;
    var data = req.body.content || '';
    fileDriver.writeFile(dirPath, data, options, 
      send200(req, res, next, formatOutData(dirPath, isDir)));
  }
};

/* PUT
  /path/to/file/or/dir
  make file or dir

  *optional*
  body.mode = permissons of file (438 default 0666 octal)
  body.encoding = default utf8

  returns: modified resource
  {
    "name" : "file1", // name of dir or file
    "path" : "/path/to/file", // path to dir or file 
    "dir" : false // true if directory
  }
*/
var putFileOrDir = function (req, res, next) { 
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  var isDir = dirPath.substr(-1) == '/';
  var options = {};

  if (isDir) {
    var mode = req.body.mode || 511;
    fileDriver.mkdir(dirPath, mode, 
      send200(req, res, next, formatOutData(dirPath, true)));
  } else {
    options.encoding = req.body.encoding  || 'utf8';
    options.mode = req.body.mode  || 438;
    var data = req.body.content || '';
    fileDriver.writeFile(dirPath, data, options, 
      send200(req, res, next, formatOutData(dirPath, false)));
  }
};

/* DEL
  /path/to/dir/
  deletes file

  return: 
  {}
*/
var delDir = function (req, res, next) { 
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  fileDriver.rmdir(dirPath, send200(req, res, next, formatOutData()));
};

/* DEL
  /path/to/file
  deletes file

  return: 
  {}
*/
var delFile = function (req, res, next) { 
  var dirPath =  decodeURI(url.parse(req.url).pathname);
  fileDriver.unlink(dirPath, send200(req, res, next, formatOutData()));
};

// Helpers
var formatOutData = function (filepath, isDir) {
  if (!filepath) return {};
  var parts = filepath.split("/");
  var filename = parts[parts.length - 1];
  var path = filepath.substr(0, filepath.length - filename.length);
  return {
      "name" : filename,
      "path" : path, 
      "dir" : isDir
    };
};

var send200 = function(req, res, next, out) {
  return function (err) {
    if (err) {
      return next(err);
    }
    res.json(200, out);
  };
};

module.exports = fileserver;