// dockerriver
// use docker exec to server files
var fs = require('fs')
var path = require('path')
var isString = require('101/is-string')
var Docker = require('./docker')
var createStreamCleanser = require('docker-stream-cleanser')
var error = require('debug')('rest-fs:dockerDriver')
var miss = require('mississippi')

function buff2String () {
  return miss.through({ objectMode: true }, function transform (chunk, enc, cb) {
    if (chunk) {
      this.push(chunk.toString())
    }
    cb()
  })
}

// returns array of files and dir. trailing slash determines type.
var list = function(args, cb) {
  var dirPath = args.dirPath
  console.log('dirpath!!!', dirPath)
  var docker = new Docker()
  docker.execContainer('8cab200b9917633cae1453267c0e250ea1141b19c0420748bbc670c45d990a1b', ['ls', '-F', dirPath], function (err, execStream) {
    var streamCleanser = createStreamCleanser()
    var filesList = []
    var concatStream = miss.concat(function (result) {
      if (result && isString(result)) {
        var files = result.split('\n')
        files = files.filter(function (f) {
          return f.length > 0
        })
        filesList = files
      }
    })
    miss.pipe(execStream, streamCleanser, buff2String(), concatStream, function (err) {
      cb(err, filesList)
    })
  })
};

/*
  read file from filepath
*/
var readFile = function(args, cb) {
  var filePath = args.filePath;
  var encoding = args.encoding;

  var docker = new Docker()
  docker.execContainer('8cab200b9917633cae1453267c0e250ea1141b19c0420748bbc670c45d990a1b', ['cat', filePath], function (err, execStream) {
    var streamCleanser = createStreamCleanser()
    var response
    var concatStream = miss.concat(function (result) {
      response = result
    })
    miss.pipe(execStream, streamCleanser, buff2String(), concatStream, function (err) {
      cb(err, response)
    })
  })
};

/*
  mkdir
*/
var mkdir = function(args, cb)  {
  var dirPath = args.dirPath;
  var mode = args.mode;

  fs.mkdir(dirPath, mode, cb);
};

/*
  delete directory
*/
var rmdir = function(args, cb)  {
  var dirPath = args.dirPath;
  var clobber = args.clobber;

  if (clobber) {
    return rm(dirPath, cb);
  }
  return fs.rmdir(dirPath, cb);
};

/*
  writeFile
*/
var writeFile = function(args, cb)  {
  var dirPath = args.dirPath;
  var data = args.data;
  var options = args.options;

  fs.writeFile(dirPath, data, options, cb);
};

/*
  write file with stream
*/
var writeFileStream = function(args, cb)  {
  var dirPath = args.dirPath;
  var stream = args.stream;
  var options = args.options;
  var file = fs.createWriteStream(dirPath, options);

  file.on('error', cb);
  file.on('finish', function() {
    cb();
  });
  stream.pipe(file);
};

/*
  delete file
*/
var unlink = function(args, cb)  {
  var dirPath = args.dirPath;

  fs.unlink(dirPath, cb);
};

/*
  move file
*/
var move = function (args, cb) {
  var oldPath = args.dirPath;
  var newPath = args.newPath;
  var opts = args.options;
  // have to remove trailing slaches
  if(oldPath.substr(-1) == '/') {
    oldPath = oldPath.substr(0, oldPath.length - 1);
  }
  if(newPath.substr(-1) == '/') {
    newPath = newPath.substr(0, newPath.length - 1);
  }

  // workaround for ncp for dirs. should error if we trying to mv into own dir
  fs.stat(oldPath, function(err, stats) {
    if (err) { return cb(err); }

    if (stats.isDirectory() &&
      ~newPath.indexOf(oldPath) &&
      newPath.split("/").length > oldPath.split("/").length) {
        err = new Error('cannot move inside itself');
        err.code = 'EPERM';
        return cb(err);
    }

    if (opts.clobber) {
      // also work around bug for clobber in dir
      return rm(newPath, function(err) {
        if (err) { return cb(err); }
        mv(oldPath, newPath, opts, cb);
      });
    }
    return mv(oldPath, newPath, opts, cb);
  });
};

/*
  stat a file
*/
var stat = function (args, cb) {
  var path = args.filePath;

  fs.stat(path, function(err, stats) {
    if (err) { return cb(err); }
    cb(null, stats);
  });
};

module.exports.list = list;
module.exports.readFile = readFile;
module.exports.mkdir = mkdir;
module.exports.rmdir = rmdir;
module.exports.writeFile = writeFile;
module.exports.unlink = unlink;
module.exports.move = move;
module.exports.writeFileStream = writeFileStream;
module.exports.stat = stat;
