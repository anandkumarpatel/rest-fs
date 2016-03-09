// dockerriver
// use docker exec to server files
var fs = require('fs')
var path = require('path')
var isString = require('101/is-string')
var Docker = require('./docker')
var createStreamCleanser = require('docker-stream-cleanser')
var error = require('debug')('rest-fs:dockerDriver')
var miss = require('mississippi')

/**
 * Convert full path like /:container-id/hellonode/README.md
 * to object with `{containerId: ':container-id', path: '/hellonode/README.md'}`
 * @param {String} - full path from which container id and path should be extracted
 * @return {Object} with `containerId` and `path` props
 */
function getContainerId (fullPath) {
  var splits = fullPath.substr(1).split(/\/(.*)/)
  return {
    containerId: splits[0],
    path: '/' + splits[1]
  }
}

function buff2String () {
  return miss.through({ objectMode: true }, function transform (chunk, enc, cb) {
    if (chunk) {
      this.push(chunk.toString())
    }
    cb()
  })
}

function execCommand (containerId, command, cb) {
  console.log('execute', containerId, command)
  var docker = new Docker()
  docker.execContainer(containerId, command, function (err, execStream) {
    var streamCleanser = createStreamCleanser()
    var response
    var concatStream = miss.concat(function (result) {
      response = result
    })
    miss.pipe(execStream, streamCleanser, buff2String(), concatStream, function (err) {
      console.log('executed', containerId, command, err, response)
      cb(err, response)
    })
  })
}

// returns array of files and dir. trailing slash determines type.
var list = function(args, cb) {
  var dirPath = args.dirPath
  var data = getContainerId(dirPath)
  var command = [ 'ls', '-F', data.path ]
  execCommand(data.containerId, command, function (err, resp) {
    if (err) {
      return cb(err)
    }
    if (resp.toLowerCase().indexOf('no such file or directory') >= 0) {
      var notFound = new Error('Not found')
      notFound.code = 'ENOTDIR'
      return cb(notFound)
    }
    var files = resp.split('\n')
    files = files.filter(function (f) {
      return f.length > 0
    })
    cb(null, files)
  })
};

/*
  read file from filepath
*/
var readFile = function(args, cb) {
  var filePath = args.filePath;
  var encoding = args.encoding;
  var data = getContainerId(filePath)
  var command = [ 'cat', filePath ]
  execCommand(data.containerId, command, function (err, resp) {
    if (err) {
      return cb(err)
    }
    if (resp.toLowerCase().indexOf('no such file or directory') >=0) {
      var notFound = new Error('Not found')
      notFound.code = 'ENOENT'
      return cb(notFound)
    }
    cb(err, resp)
  })
};

/*
  mkdir
*/
var mkdir = function(args, cb)  {
  var dirPath = args.dirPath
  var mode = args.mode
  var data = getContainerId(filePath)
  var command = ['/bin/bash', '-c', 'mkdir -m ' + mode + ' -p ' + data.path]
  execCommand(data.containerId, command, function (err, resp) {
    if (err) {
      return cb(err)
    }
    cb(err, resp)
  })
};

/*
  delete directory
*/
var rmdir = function(args, cb)  {
  var dirPath = args.dirPath;
  var clobber = args.clobber;
  var data = getContainerId(dirPath)
  var docker = new Docker()

  var command = ['rm', '-fd', data.path]
  if (clobber) {
    command = ['rm', '-fdr', data.path]
  }
  execCommand(data.containerId, command, function (err, resp) {
    if (err) {
      return cb(err)
    }
    if (resp.toLowerCase().indexOf('no such file or directory') >=0) {
      var notFound = new Error('Not found')
      notFound.code = 'ENOENT'
      return cb(notFound)
    }
    cb(null, resp)
  })
};

/*
  writeFile
*/
var writeFile = function(args, cb)  {
  var dirPath = args.dirPath
  var content = args.data
  var options = args.options
  var data = getContainerId(dirPath)
  var mode = args.mode
  var command = ['/bin/bash', '-c', 'echo "' + content + '" > ' + data.path]
  execCommand(data.containerId, command, function (err, resp) {
    if (err) {
      return cb(err)
    }
    cb(err, resp)
  })
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
  var data = getContainerId(dirPath)
  var command = ['rm', data.path]
  execCommand(data.containerId, command, function (err, resp) {
    if (err) {
      return cb(err)
    }
    if (resp.toLowerCase().indexOf('no such file or directory') >= 0) {
      var notFound = new Error('Not found')
      notFound.code = 'ENOENT'
      return cb(notFound)
    }
    if (resp.length > 0) {
      var error = new Error('Deletion error found')
      error.message = response
      return cb(error)
    }
    cb(null, resp)
  })
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
