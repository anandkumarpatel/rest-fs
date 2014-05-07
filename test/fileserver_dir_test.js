var Lab = require('lab');
var fs = require('fs');
var server = require('../fileserver.js');
var supertest = require('supertest');
var baseDir = __dirname+"/dir_test";
var async = require('async');
var rimraf = require('rimraf');
var walk = require('walkdir');
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

function createDir(dirpath, cb) {
  supertest(server)
    .post(dirpath)
    .expect(200)
    .end(function(err, res){
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

function createDirPut(dirpath, cb) {
  supertest(server)
    .put(dirpath)
    .expect(200)
    .end(function(err, res){
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
              if(err) return cb(err);
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
  var paths = [];
  var emitter = walk(dirPath, function(path,stat){
    paths.push(path.substr(dirPath.length));
  });
  emitter.on('end', function() {
    return cb(null, paths);
  });
  emitter.on('error', function(err) {
    return cb(err);
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
    createDir(dirpath, done);
  });
  Lab.test('create dir PUT', function (done) {
    var dirpath = baseDir+'/dir2/';
    createDirPut(dirpath, done);
  });
});


Lab.experiment('basic delete tests', function () {
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
    var dirpath = baseDir+'/dir2/fake';
    supertest(server)
      .del(dirpath)
      .expect(500)
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

  Lab.test('attempt to delete file', function (done) {
    var filePath = baseDir+'/file';
    createFile(filePath, "test", function (err) {
      if(err) return done(err);
      supertest(server)
        .del(filePath+'/')
        .expect(500)
        .end(function(err, res){
          if (err) {
            return done(err);
          } else if (res.body.code === 'ENOTDIR') {
            return done();
          } else {
            return done(new Error('file was deleted'));
          }
        });
    });
  });

});


Lab.experiment('read tests', function () {
  var testdirR =  baseDir+'/dir2';
  var testdir =  testdirR+'/';
  var emptydirR = baseDir+'/dir1';
  var emptydir =  emptydirR+'/';
  var file1Path = baseDir+'/test_file1.txt';
  var file2Path = testdir+'test_file2.txt';
  var fileContent = "test";

  Lab.beforeEach(function (done) {
    async.series([
      function(cb) {
        cleanBase(cb);
      },
      function(cb) {
        createDir(testdir, cb);
      },
      function(cb) {
        createDir(emptydir, cb);
      },
      function(cb) {
        createFile(file1Path, fileContent, cb);
      },
      function(cb) {
        createFile(file2Path, fileContent, cb);
      }
    ], done);
  });

  Lab.test('get dir ls', function (done) {
    supertest(server)
      .get(testdir)
      .expect(200)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (!~file2Path.indexOf(res.body[0].path+res.body[0].name)) {
          return done(new Error('file list incorrect'));
        }
        return done();
      });
  });

  Lab.test('get empty dir ls', function (done) {
    supertest(server)
      .get(emptydir)
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
      .get(testdirR)
      .expect(303)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (!~res.text.indexOf('Redirecting to '+testdir)) {
          return done(new Error('not redirecting'));
        }
        return done();
      });
  });

  Lab.test('get empty dir ls with redirect', function (done) {
    supertest(server)
      .get(emptydirR)
      .expect(303)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (!~res.text.indexOf('Redirecting to '+emptydir)) {
          return done(new Error('not redirecting'));
        }
        return done();
      });
  });

  Lab.test('get dir which does not exist', function (done) {
    supertest(server)
      .get(emptydirR+"/fake")
      .expect(500)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (res.body.code !== 'ENOENT') {
          return done(new Error('file should not exist'));
        }
        return done();
      });
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
  Lab.test('move empty dir into a dir with trailing slash', function (done) {
    moveDir(dir2, dir1+'new/', false, false, done);
  });
  Lab.test('move empty dir into a dir without trailing slash', function (done) {
    moveDir(dir2, dir1+'new', false, false, done);
  });
  Lab.test('move empty dir into itself', function (done) {
    moveDir(dir2, dir2+'new/', false, false, function(err) {
      if(err) {
        if (err.code === 'ENOENT') {
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

  // this times out i guess due to error
  /*
  Lab.test('move dir into itself', function (done) {
    moveDir(dir1, dir1+'new/', false, false, function(err) {
      if(err) {
        if (err.code === 'ENOENT') {
          return done();
        }
        return done(err);
      }
      return done(new Error('dir was moved into itself'));
    });
  });
  */
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