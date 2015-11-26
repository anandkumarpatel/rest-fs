// fsDriver
// use fs engine to server files
var fs = require('fs');
var findit = require('findit');
var path = require('path');
var mv = require('mv');
var rm = require('rimraf');
var error = require('debug')('rest-fs:fsDriver');

// returns array of files and dir. trailing slash determines type.
var listAll = function(args, cb) {
  var dirPath = args.dirPath;
  var finder = findit(dirPath);
  var files = [];

  finder.on('directory', function (dir, stat, stop) {
    files.push(path.join(dir, '/'));
  });

  finder.on('file', function (file, stat) {
    files.push(file);
  });

  finder.on('end', function () {
    cb(null, files);
  });
};

// returns array of files and dir. trailing slash determines type.
var list = function(args, cb) {
  var dirPath = args.dirPath;
  var filesList = [];
  var cnt = 0;
  fs.readdir(dirPath, function (err, files) {
    if (err) { return cb(err); }

    if (files.length === 0) {
      return cb(null, []);
    }
    var formatFileList = function(index) {
      return function (err, stat) {
        // here we do something special. if stat failes we know that there is something here
        // but we might not have permissons. show it as a file.
        if (err) {
          error('lstat error', err.stack);
        }
        else {
          var isDir = stat.isDirectory() ? '/' : '';
          var file = path.join(dirPath, files[index], isDir);
          filesList.push(file);
        }

        cnt++;
        if (cnt === files.length) {
          return cb(null, filesList);
        }
      };
    };
    for (var i = 0; i < files.length; i++) {
      fs.lstat(path.join(dirPath, files[i]), formatFileList(i));
    }
  });
};

/*
  read file from filepath
*/
var readFile = function(args, cb) {
  var filePath = args.filePath;
  var encoding = args.encoding;

  fs.readFile(filePath, encoding, cb);
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
  console.log('XXX', args)
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

module.exports.listAll = listAll;
module.exports.list = list;
module.exports.readFile = readFile;
module.exports.mkdir = mkdir;
module.exports.rmdir = rmdir;
module.exports.writeFile = writeFile;
module.exports.unlink = unlink;
module.exports.move = move;
module.exports.writeFileStream = writeFileStream;
module.exports.stat = stat;
