// fsDriver
// use fs engine to server files
var path = require('path');
var error = require('debug')('rest-fs:fsDriver');

module.exports = function({fs = require('fs'), basePath = ''} = {}) {
// returns array of files and dir. trailing slash determines type.
var listAll = function(args, cb) {
  var dirPath = basePath + args.dirPath;
  const result = [];
  const files = [dirPath];
  do {
    const filepath = files.pop();
    const stat = fs.lstatSync(filepath);
    if (stat.isDirectory()) {
      fs
          .readdirSync(filepath)
          .forEach(f => files.push(path.join(filepath, f)));
    } else if (stat.isFile()) {
      result.push(path.relative(reqDir, filepath));
    }
  } while (files.length !== 0);

  cb(null, result);
};

// returns array of files and dir. trailing slash determines type.
var list = function(args, cb) {
  var dirPath = basePath + args.dirPath;
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
  var filePath = basePath + args.filePath;
  var encoding = args.encoding;

  fs.readFile(filePath, encoding, cb);
};

/*
  mkdir
*/
var mkdir = function(args, cb)  {
  var dirPath = basePath + args.dirPath;
  var mode = args.mode;

  fs.mkdir(dirPath, mode, cb);
};

/*
  delete directory
*/
var rmdir = function(args, cb)  {
  var dirPath = basePath + args.dirPath;
  var clobber = args.clobber;

  if (clobber) {
    return fs.unlink(dirPath, cb);
  }
  return fs.rmdir(dirPath, cb);
};

/*
  writeFile
*/
var writeFile = function(args, cb)  {
  var dirPath = basePath + args.dirPath;
  var data = args.data;
  var options = args.options;

  fs.writeFile(dirPath, data, options, cb);
};

/*
  write file with stream
*/
var writeFileStream = function(args, cb)  {
  var dirPath = basePath + args.dirPath;
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
  var dirPath = basePath + args.dirPath;

  fs.unlink(dirPath, cb);
};

/*
  move file
*/
var move = function (args, cb) {
  var oldPath = basePath + args.dirPath;
  var newPath = basePath + args.newPath;
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
      return fs.unlink(newPath, function(err) {
        if (err) { return cb(err); }
        fs.rename(oldPath, newPath, cb);
      });
    }
    return fs.rename(oldPath, newPath, cb);
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
  return {listAll,list,readFile,mkdir,rmdir,writeFile,unlink,move,writeFileStream,stat};
}
