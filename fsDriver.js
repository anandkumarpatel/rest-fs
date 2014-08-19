// fsDriver
// use fs engine to server files
var fs = require('fs');
var findit = require('findit');
var path = require('path');
var mv = require('mv');
var rm = require('rimraf');

// returns array of files and dir. trailing slash determines type.
var listAll = function(reqDir, onlyDir, cb) {
  var finder = findit(reqDir);
  var files = [];

  finder.on('directory', function (dir, stat, stop) {
    files.push(path.join(dir, '/'));
  });

  if (!onlyDir) {
    finder.on('file', function (file, stat) {
      files.push(file);
    });
  }

  finder.on('end', function () {
    cb(null, files);
  });
};

// returns array of files and dir. trailing slash determines type.
var list = function(reqDir, cb) {
  var filesList = [];
  var cnt = 0;
  fs.readdir(reqDir, function (err, files) {
    if (err) {
      return cb(err);
    }
    if (files.length === 0) {
      return cb(null, []);
    }
    var formatFileList = function(index) {
      return function (err, stat) {
        if (err) {
          return cb(err);
        }
        var file = path.join(reqDir, files[index], stat.isDirectory() ? '/' : '');
        filesList.push(file);
        cnt++;
        if (cnt === files.length) {
          return cb(null, filesList);
        }
      };
    };
    for (var i = 0; i < files.length; i++) {
      fs.stat(path.join(reqDir, files[i]), formatFileList(i));
    }
  });
};

/*
  read file from filepath
*/
var readFile = function(filePath, encoding, cb) {
  fs.readFile(filePath, encoding, cb);
};

/*
  mkdir
*/
var mkdir = function(dirPath, mode, cb)  {
  fs.mkdir(dirPath, mode, cb);
};

/*
  delete directory
*/
var rmdir = function(dirPath, clobber, cb)  {
  if (clobber) {
    return rm(dirPath, cb);
  }
  return fs.rmdir(dirPath, cb);
};

/*
  writeFile
*/
var writeFile = function(filename, data, options, cb)  {
  fs.writeFile(filename, data, options, cb);
};

/*
  write file with stream
*/
var writeFileStream = function(filepath, stream, options, cb)  {
  try {
    var file = fs.createWriteStream(filepath, options);
    stream.pipe(file);
    cb();
  } catch(err) {
    cb(err);
  }
};

/*
  delete file
*/
var unlink = function(filename, cb)  {
  fs.unlink(filename, cb);
};

/*
  move file
*/
var move = function (oldPath, newPath, opts, cb) {
  // have to remove trailing slaches
  if(oldPath.substr(-1) == '/') {
    oldPath = oldPath.substr(0, oldPath.length - 1);
  }
  if(newPath.substr(-1) == '/') {
    newPath = newPath.substr(0, newPath.length - 1);
  }


  // workaround for ncp for dirs. should error if we trying to mv into own dir
  fs.stat(oldPath, function(err, stats) {
    if (err) {
      return cb(err);
    }
    else if (stats.isDirectory() &&
      ~newPath.indexOf(oldPath) &&
      newPath.split("/").length > oldPath.split("/").length) {
        err = new Error('cannot move inside itself');
        err.code = 'EPERM';
        return cb(err);
    } else if (opts.clobber) {
      // also work around bug for clobber in dir
      rm(newPath, function(err) {
        if (err) { return cb(err); }
        return mv(oldPath, newPath, opts, cb);
      });
    } else {
      return mv(oldPath, newPath, opts, cb);
    }
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
