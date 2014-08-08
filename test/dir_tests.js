var Lab = require('lab');
var fs = require('fs');
var express = require('express');
var server = express();
var restfs = require('../fileserver.js');
restfs(server);
var supertest = require('supertest');
var baseDir = __dirname+"/dir_test";
var async = require('async');
var rimraf = require('rimraf');
var walk = require('walkdir');
var _ = require('lodash');

// attach the .compare method to Array's prototype to call it on any array
Array.prototype.compare = function (array) {
  if (!array)
      return false;
  if (this.length != array.length)
      return false;
  var isMatch = false;
  for (var me in this) {
    isMatch = false;
    for (var other in array) {
      if (me === other) {
        isMatch = true;
        break;
      }
    }
    if(!isMatch) {
      return false;
    }
  }
  return true;
};

Lab.before(function (done) {
  cleanBase(done);
});
Lab.after(function (done) {
  rimraf(baseDir, done);
});

function cleanBase(cb) {
  rimraf(baseDir, function(err) {
    fs.mkdir(baseDir, cb);
  });
}

function createDir(dirpath, opts, cb) {
 if(typeof opts === 'function') {
  cb = opts;
  opts = null;
 }
  var req = supertest(server).put(dirpath);
  if (opts) {
    req.send(opts);
  }
  req.expect(201).end(function(err, res){
    if (err) {
      return cb(err);
    }
    fs.stat(dirpath, function (err, stats) {
      if (err) {
        return cb(err);
      } else if (!stats.isDirectory()) {
        return cb(new Error('dir did not get created'));
      } else {
        return cb();
      }
    });
  });
}

function createDirPost(dirpath, opts, cb) {
 if(typeof opts === 'function') {
  cb = opts;
  opts = null;
 }
  var req = supertest(server).post(dirpath);
  if (opts) {
    req.send(opts);
  }
  req.expect(201).end(function(err, res){
    if (err) {
      return cb(err);
    }
    fs.stat(dirpath, function (err, stats) {
      if (err) {
        return cb(err);
      } else if (!stats.isDirectory()) {
        return cb(new Error('dir did not get created'));
      } else {
        return cb();
      }
    });
  });
}
function createFile(filepath, text, cb) {
  var data = text || '';
  fs.writeFile(filepath, data, cb);
}

function moveDir(oldpath, newPath, doClobber, doMkdirp, cb) {
  getDirContents(oldpath, function(err, oldPaths) {
    if(err) return cb(err);
    supertest(server)
      .post(oldpath)
      .send({
        newPath: newPath,
        clobber: doClobber,
        mkdirp: doMkdirp
      })
      .end(function(err, res) {
        if (err) {
          return cb(err);
        } else if (200 !== res.statusCode) {
          return cb(res.body);
        }
        async.series([
          function(next) {
            // old path should not exist
            fs.stat(oldpath, function (err, stats) {
              if (err) {
                if (err.code === 'ENOENT') {
                  return next();
                }
                return next(err);
              } else {
                return next(new Error('old dir did not move'));
              }
            });
          },
          function(next) {
            // new path should exist
            fs.stat(newPath, function (err, stats) {
              if (err) {
                return next(err);
              } else if (stats.isDirectory()) {
                return next();
              } else {
                return next(new Error('dir did not get moved correctly'));
              }
            });
          },
          function(next) {
            // new dir structure should match old structure
            getDirContents(newPath, function(err, newPaths) {
              if(err) return next(err);
              if(newPaths.compare(oldPaths)) {
                return next();
              } else {
                return next(new Error('new dir does not match moved one'));
              }
            });
          }
        ], cb);
      });
  });
}

function getDirContents(dirPath, cb) {
  // remove trailing slash
  if (dirPath.substr(-1) === '/') {
    dirPath = dirPath.substr(0, dirPath.length - 1);
  }
  var error = null;
  var paths = [];
  var emitter = walk(dirPath, function(path,stat){
    paths.push(path.substr(dirPath.length));
  });
  emitter.on('end', function() {
    return cb(error, paths);
  });
  emitter.on('error', function(err) {
    error = new Error("error on file: "+err);
    error.code = 'EINVAL';
    emitter.end();
  });
}

/*
  START TEST
*/

Lab.experiment('create tests', function () {
  Lab.beforeEach(function (done) {
    cleanBase(done);
  });
  Lab.test('create dir POST', function (done) {
    var dirpath = baseDir+'/dir2/';
    createDirPost(dirpath, done);
  });
  Lab.test('create dir POST with mode 400', function (done) {
    var dirpath = baseDir+'/dir2/';
    createDirPost(dirpath, {mode: 400}, done);
  });
  Lab.test('create dir PUT', function (done) {
    var dirpath = baseDir+'/dir2/';
    createDir(dirpath, done);
  });
  Lab.test('create dir PUT with mode 400', function (done) {
    var dirpath = baseDir+'/dir2/';
    createDir(dirpath, {mode: 400}, done);
  });
});


Lab.experiment('delete tests', function () {
  Lab.beforeEach(function (done) {
    cleanBase(done);
  });
  Lab.test('delete dir', function (done) {
    var dirpath = baseDir+'/dir2/';
    createDir(dirpath, function(err) {
      if (err) {
        return done(err);
      }
      supertest(server)
        .del(dirpath)
        .expect(200)
        .end(function(err, res){
          if (err) {
            return done(err);
          }
          fs.stat(dirpath, function (err, stats) {
            if (err) {
              if (err.code === 'ENOENT') {
                return done();
              }
              return done(err);
            } else {
              return done(new Error('dir did not get deleted'));
            }
          });
        });
    });
  });

  Lab.test('delete nonexiting dir', function (done) {
    var dirpath = baseDir+'/dir2/fake/';
    supertest(server)
      .del(dirpath)
      .expect(404)
      .end(function(err, res){
        if (err) {
          return done(err);
        }
        fs.stat(dirpath, function (err, stats) {
          if (err) {
            if (err.code === 'ENOENT') {
              return done();
            }
            return done(err);
          } else {
            return done(new Error('remove returned unexpected error'));
          }
        });
      });
  });

  Lab.test('attempt to delete file with trailing slash', function (done) {
    var filePath = baseDir+'/file';
    createFile(filePath, "test", function (err) {
      if(err) return done(err);
      supertest(server)
        .del(filePath+'/')
        .expect(400)
        .end(done);
    });
  });

  Lab.test('attempt to a folder with files and folders in it without clobber', function (done) {
    var dir1 =  baseDir+'/dir1/';
    var file1 = dir1+'/file1';
    var file2 = dir1+'/file2';
    var dir1_dir1 =  dir1+'/dir1/';
    var dir1_file1 = dir1_dir1+'/file1';
    var dir1_file2 = dir1_dir1+'/file2';
    var fileContent = "testing one two three and I am stopping now";
    async.series([
      function(cb) {
        cleanBase(cb);
      },
      function(cb) {
        createDir(dir1, cb);
      },
      function(cb) {
        createDir(dir1_dir1, cb);
      },
      function(cb) {
        createFile(file1, fileContent, cb);
      },
      function(cb) {
        createFile(file2, fileContent, cb);
      },
      function(cb) {
        createFile(dir1_file1, fileContent, cb);
      },
      function(cb) {
        createFile(dir1_file2, fileContent, cb);
      }
    ], function (err) {
      if (err) {
        return done(err);
      }
      supertest(server)
        .del(dir1)
        .expect(409)
        .end(function(err, res){
          if (err) {
            return done(err);
          }
          if (res.body.code !== 'ENOTEMPTY') {
            return done(new Error('should have returned ENOTEMPTY'));
          }
          fs.stat(dir1, function (err, stats) {
            if (err) {
              return done(new Error('dir got deleted'));
            } else {
              return done();
            }
          });
        });
    });
  });

  Lab.test('attempt to a folder with files and folders in it with clobber', function (done) {
    var dir1 =  baseDir+'/dir1/';
    var file1 = dir1+'/file1';
    var file2 = dir1+'/file2';
    var dir1_dir1 =  dir1+'/dir1/';
    var dir1_file1 = dir1_dir1+'/file1';
    var dir1_file2 = dir1_dir1+'/file2';
    var fileContent = "testing one two three and I am stopping now";
    async.series([
      function(cb) {
        cleanBase(cb);
      },
      function(cb) {
        createDir(dir1, cb);
      },
      function(cb) {
        createDir(dir1_dir1, cb);
      },
      function(cb) {
        createFile(file1, fileContent, cb);
      },
      function(cb) {
        createFile(file2, fileContent, cb);
      },
      function(cb) {
        createFile(dir1_file1, fileContent, cb);
      },
      function(cb) {
        createFile(dir1_file2, fileContent, cb);
      }
    ], function (err) {
      if (err) {
        return done(err);
      }
      supertest(server)
        .del(dir1)
        .send({clobber: true})
        .expect(200)
        .end(function(err, res){
          if (err) {
            return done(err);
          }
          fs.stat(dir1, function (err, stats) {
            if (err) {
              if (err.code === 'ENOENT') {
                return done();
              }
              return done(err);
            }
            return done(new Error('dir did not get deleted'));
          });
        });
      });
    });
});


Lab.experiment('read tests', function () {
  var dir2R =  baseDir+'/dir2';
  var dir2 =  dir2R+'/';
  var dir1D = baseDir+'/dir1';
  var dir1 =  dir1D+'/';
  var file1 = baseDir+'/file1.txt';
  var dir1_file1 = dir2+'file2.txt';
  var fileContent = "test";

  Lab.beforeEach(function (done) {
    async.series([
      function(cb) {
        cleanBase(cb);
      },
      function(cb) {
        createDir(dir2, cb);
      },
      function(cb) {
        createDir(dir1, cb);
      },
      function(cb) {
        createFile(file1, fileContent, cb);
      },
      function(cb) {
        createFile(dir1_file1, fileContent, cb);
      }
    ], done);
  });

  Lab.test('get dir ls', function (done) {
    supertest(server)
      .get(dir2)
      .expect(200)
      .end(function(err, res){
        if (err) {
          return done(err);
        } if (res.body.length !== 1 || (_.difference(res.body, [ dir1_file1 ])).length) {
          return done(new Error('file list incorrect'));
        }
        return done();
      });
  });

  Lab.test('test setModifyOut', function (done) {
    var server2 = express();
    server2.use(function(req, res, next) {
      req.modifyOut = function (file) {
        return 'anand';
      };
      next();
    });
    var restfs = require('../fileserver.js');
    restfs(server2);
    supertest(server2)
      .get(dir2)
      .expect(200)
      .end(function(err, res){
        if (err) {
          return done(err);
        } if (res.body.length !== 1 || (_.difference(res.body, ['anand'])).length) {
          return done(new Error('file list incorrect'));
        }
        return done();
      });
  });


  Lab.test('get filled dir ls', function (done) {
    supertest(server)
      .get(baseDir+'/')
      .expect(200)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (res.body.length !== 3 || (_.difference(res.body, [ dir1, dir2, file1 ])).length) {
          return done(new Error('file list incorrect'));
        }
        return done();
      });
  });

  Lab.test('get dir ls recursive', function (done) {
    supertest(server)
      .get(baseDir+'/')
      .query({recursive: "true"})
      .expect(200)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (res.body.length != 5 || (_.difference(res.body, [ baseDir+'/', dir1, dir2, file1, dir1_file1 ])).length) {
          return done(new Error('file list incorrect'));
        }
        return done();
      });
  });

  Lab.test('get empty dir ls', function (done) {
    supertest(server)
      .get(dir1)
      .expect(200)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (res.body.length) {
          return done(new Error('file list incorrect'));
        }
        return done();
      });
  });

  Lab.test('get dir ls with redirect', function (done) {
    supertest(server)
      .get(dir2R)
      .expect(303)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (!~res.text.indexOf('Redirecting to '+dir2)) {
          return done(new Error('not redirecting'));
        }
        return done();
      });
  });

  Lab.test('get empty dir ls with redirect', function (done) {
    supertest(server)
      .get(dir1D)
      .expect(303)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (!~res.text.indexOf('Redirecting to '+dir1)) {
          return done(new Error('not redirecting'));
        }
        return done();
      });
  });

  Lab.test('get dir which does not exist', function (done) {
    supertest(server)
      .get(dir1D+"/fake/")
      .expect(404)
      .end(done);
  });
});

Lab.experiment('move tests', function () {
  var dir1 =  baseDir+'/dir1/';
  var dir2 =  baseDir+'/dir2/'; // empty
  var dir3 =  baseDir+'/dir3/';

  var dir1_file1 = dir1+'test_file1.txt';
  var dir1_dir1  = dir1+'dir1/';
  var dir1_dir1_file1 = dir1_dir1+'test_file2.txt';

  var dir3_file1 = dir3+'test_file1.txt';

  var fileContent = "test";

  Lab.beforeEach(function (done) {
    async.series([
      function(cb) {
        cleanBase(cb);
      },
      function(cb) {
        createDir(dir1, cb);
      },
      function(cb) {
        createDir(dir2, cb);
      },
      function(cb) {
        createDir(dir3, cb);
      },
      function(cb) {
        createDir(dir1_dir1, cb);
      },
      function(cb) {
        createFile(dir1_file1, fileContent, cb);
      },
      function(cb) {
        createFile(dir3_file1, fileContent, cb);
      },
      function(cb) {
        createFile(dir1_dir1_file1, fileContent, cb);
      }
    ], done);
  });

  Lab.test('move empty dir in same dir (rename) with trailing slash', function (done) {
    moveDir(dir2, baseDir+'/new/', false, false, done);
  });
  Lab.test('move empty dir in same dir (rename) without trailing slash', function (done) {
    moveDir(dir2, baseDir+'/new', false, false, done);
  });
  Lab.test('move empty dir to itself', function (done) {
    moveDir(dir2, dir2, false, false, function(err) {
      if(err) {
        if (err.code === 'EEXIST') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was moved on top of itself'));
    });
  });
  Lab.test('move empty dir to same dir with similar name', function (done) {
    moveDir(dir2, dir2.substr(0, dir2.length - 1)+"add", false, false, done);
  });
  Lab.test('move empty dir into a dir with trailing slash', function (done) {
    moveDir(dir2, dir1+'new/', false, false, done);
  });
  Lab.test('move empty dir into a dir without trailing slash', function (done) {
    moveDir(dir2, dir1+'new', false, false, done);
  });
  Lab.test('move empty dir into itself', function (done) {
    moveDir(dir2, dir2+'new/', false, false, function(err) {
      if(err) {
        if (err.code === 'EPERM') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was moved into itself'));
    });
  });

  Lab.test('move empty dir out of dir', function (done) {
    moveDir(dir2, dir1+'new/', false, false, function(err) {
      if (err) return done(err);
      moveDir(dir1+'new/', dir2, false, false, done);
    });
  });

  Lab.test('move empty dir onto existing dir', function (done) {
    moveDir(dir2, dir1, false, false, function(err) {
      if(err) {
        if (err.code === 'EEXIST') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was overritting without clobber'));
    });
  });

  Lab.test('move empty dir onto existing dir with clobber', function (done) {
    moveDir(dir2, dir1, true, false, done);
  });

  Lab.test('move empty dir into non existing dir', function (done) {
    moveDir(dir2, dir1+'fake/dir/', false, false, function(err) {
      if(err) {
        if (err.code === 'ENOENT') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was created without mkdirp'));
    });
  });

   Lab.test('move non existing dir into existing dir', function (done) {
    moveDir(dir2+'fake/dir/', dir1, false, false, function(err) {
      if(err) {
        if (err.code === 'EINVAL') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was created without mkdirp'));
    });
  });

  Lab.test('move non existing dir into non existing dir', function (done) {
    moveDir(dir2+'fake/dir/', dir1+'fake/dir/', false, false, function(err) {
      if(err) {
        if (err.code === 'EINVAL') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was created without mkdirp'));
    });
  });

  Lab.test('move empty dir into non existing dir with mkdirp', function (done) {
    moveDir(dir2, dir1+'fake/dir/', false, true, done);
  });

  Lab.test('move empty dir into non existing long dir with mkdirp', function (done) {
    moveDir(dir2, dir1+'fake/long/long/long/dir/', false, true, done);
  });

  // now try with full dir
  Lab.test('move dir in same dir (rename) with trailing slash', function (done) {
    moveDir(dir1, baseDir+'/new/', false, false, done);
  });
  Lab.test('move dir in same dir (rename) without trailing slash', function (done) {
    moveDir(dir1, baseDir+'/new', false, false, done);
  });
  Lab.test('move dir into a dir with trailing slash', function (done) {
    moveDir(dir1, dir2+'new/', false, false, done);
  });
  Lab.test('move dir into a dir without trailing slash', function (done) {
    moveDir(dir1, dir2+'new', false, false, done);
  });
  Lab.test('move dir to itself', function (done) {
    moveDir(dir1, dir1, false, false, function(err) {
      if(err) {
        if (err.code === 'EEXIST') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was moved on top of itself'));
    });
  });
  Lab.test('move dir to same dir with similar name', function (done) {
    moveDir(dir1, dir1.substr(0, dir2.length - 1)+"add", false, false, done);
  });
  Lab.test('move dir to itself', function (done) {
    moveDir(dir1, dir1, false, false, function(err) {
      if(err) {
        if (err.code === 'EEXIST') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was moved on top of itself'));
    });
  });

  Lab.test('move dir into itself', function (done) {
    moveDir(dir1, dir1+'new/', false, false, function(err) {
      if(err) {
        if (err.code === 'EPERM') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was moved into itself'));
    });
  });

  Lab.test('move dir out of dir', function (done) {
    moveDir(dir1, dir2+'new/', false, false, function(err) {
      if (err) return done(err);
      moveDir(dir2+'new/', dir1, false, false, done);
    });
  });

  Lab.test('move dir onto existing dir', function (done) {
    moveDir(dir1, dir2, false, false, function(err) {
      if(err) {
        if (err.code === 'EEXIST') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was overritting without clobber'));
    });
  });

  Lab.test('move dir onto existing dir with clobber', function (done) {
    moveDir(dir1, dir2, true, false, done);
  });

  Lab.test('move dir into non existing dir', function (done) {
    moveDir(dir1, dir2+'fake/dir/', false, false, function(err) {
      if(err) {
        if (err.code === 'ENOENT') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was created without mkdirp'));
    });
  });

  Lab.test('move dir into non existing dir with mkdirp', function (done) {
    moveDir(dir1, dir2+'fake/dir/', false, true, done);
  });

  Lab.test('move dir into non existing long dir with mkdirp', function (done) {
    moveDir(dir1, dir2+'fake/long/long/long/dir/', false, true, done);
  });

  Lab.test('clober from inside dir to an empty one above it', function (done) {
    moveDir(dir1_dir1, dir2, false, false, function(err) {
      if(err) {
        if (err.code === 'EEXIST') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was overwritten without clober'));
    });
  });

  Lab.test('clober from inside dir to an empty one above it with clober', function (done) {
    moveDir(dir1_dir1, dir2, true, false, done);
  });

  Lab.test('clober from inside dir to an full one above it', function (done) {
    moveDir(dir1_dir1, dir3, false, false, function(err) {
      if(err) {
        if (err.code === 'EEXIST') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was overwritten without clober'));
    });
  });

  Lab.test('clober from inside dir to an full one above it with clobber', function (done) {
    moveDir(dir1_dir1, dir3, true, false, done);
  });

});
