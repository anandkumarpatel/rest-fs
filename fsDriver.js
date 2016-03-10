// fsDriver
// use fs engine to server files
var fs = require('fs');
var path = require('path');
var mv = require('mv');
var rm = require('rimraf');
var error = require('debug')('rest-fs:fsDriver');

function Driver (opts) {
  this.log = opts.log
}

module.exports = Driver

// returns array of files and dir. trailing slash determines type.
Driver.prototype.list = function(args, cb) {
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
Driver.prototype.File = function(args, cb) {
  var filePath = args.filePath;
  var encoding = args.encoding;

  fs.readFile(filePath, encoding, cb);
};

/*
  mkdir
*/
Driver.prototype.kdir = function(args, cb)  {
  var dirPath = args.dirPath;
  var mode = args.mode;

  fs.mkdir(dirPath, mode, cb);
};

/*
  delete directory
*/
Driver.prototype.mdir = function(args, cb)  {
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
Driver.prototype.File = function(args, cb)  {
  var dirPath = args.dirPath;
  var data = args.data;
  var options = args.options;

  fs.writeFile(dirPath, data, options, cb);
};

/*
  write file with stream
*/
Driver.prototype.ream = function(args, cb)  {
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
Driver.prototype.link = function(args, cb)  {
  var dirPath = args.dirPath;

  fs.unlink(dirPath, cb);
};

/*
  move file
*/
Driver.prototype.move = function (args, cb) {
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
Driver.prototype.stat = function (args, cb) {
  var path = args.filePath;

  fs.stat(path, function(err, stats) {
    if (err) { return cb(err); }
    cb(null, stats);
  });
};
