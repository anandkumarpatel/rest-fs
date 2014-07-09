var Lab = require('lab');
var fs = require('fs');
var express = require('express');
var server = express();
var restfs = require('../fileserver.js');
restfs(server);
var supertest = require('supertest');
var baseFolder = __dirname+"/file_test";
var async = require('async');
var rimraf = require('rimraf');
Lab.before(function (done) {
  cleanBase(done);
});
Lab.after(function (done) {
  rimraf(baseFolder, done);
});

function cleanBase(cb) {
  rimraf(baseFolder, function(err) {
    fs.mkdir(baseFolder, cb);
  });
}

function createFile(filepath, opts, cb) {
  if(typeof opts === 'function') {
    cb = opts;
    opts = null;
  }
  var req = supertest(server).put(filepath);
  if (opts) {
    req.send(opts);
  } 
  req.end(function(err, res){
    if (err) {
      return cb(err);
    }
    fs.stat(filepath, function (err, stats) {
      if (err) {
        return cb(err);
      } else if (stats.isFile()) {
        return cb();
      } else {
        return cb(new Error('file did not get created'));
      }
    });
  });
}

function createFilePost(filepath, opts, cb) {
  if(typeof opts === 'function') {
    cb = opts;
    opts = null;
  }
  var req = supertest(server).post(filepath);
  if (opts) {
    req.send(opts);
  } 
  req.end(function(err, res){
    if (err) {
      return cb(err);
    }
    fs.stat(filepath, function (err, stats) {
      if (err) {
        return cb(err);
      } else if (stats.isFile()) {
        return cb();
      } else {
        return cb(new Error('file did not get created'));
      }
    });
  });
}

function moveFile(oldpath, newPath, doClobber, doMkdirp, cb) {
  supertest(server)
    .post(oldpath)
    .send({
      newPath: newPath,
      clobber: doClobber,
      mkdirp: doMkdirp
    })
    .end(function(err, res){
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
              return next(new Error('old file did not move'));
            }
          });
        },
        function(next) {
          // new path should exist
          fs.stat(newPath, function (err, stats) {
            if (err) {
              return next(err);
            } else if (stats.isFile()) {
              return next();
            } else {
              return next(new Error('file did not get moved correctly'));
            }
          });
        }
      ], cb);
    });
}

function createDir(dirPath, cb) {
  fs.mkdir(dirPath, cb);
}

Lab.experiment('basic create tests', function () {
  Lab.beforeEach(function (done) {
    cleanBase(done);
  });

  Lab.test('create empty file PUT', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    createFile(filepath, done);
  });

  Lab.test('create empty file POST', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    createFilePost(filepath, done);
  });

  Lab.test('create empty file POST w/ encoding', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    createFilePost(filepath, {encoding: "utf8"}, done);
  });

  Lab.test('create empty file POST w/ mode', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    createFilePost(filepath, {mode: 777}, done);
  });

  Lab.test('create empty file POST w/ content', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    createFilePost(filepath, {content: "testText"}, done);
  });

  Lab.test('create empty file PUT w/ encoding', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    createFile(filepath, {encoding: "utf8"}, done);
  });

  Lab.test('create empty file PUT w/ mode', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    createFile(filepath, {mode: 777}, done);
  });

  Lab.test('create file with spaces in filename PUT', function (done) {
    var filepath = baseFolder+'/test file.txt';
    createFile(filepath, done);
  });

  Lab.test('create file with text PUT', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    var testText = "test";
    createFile(filepath, {content: testText}, function(err) {
      fs.readFile(filepath, {
        encoding: 'utf8'
      }, function (err, data) {
        if (err) {
          return done(err);
        } else if (!~data.indexOf(testText)) {
          return done(new Error('incorrect data'));
        } else {
          return done();
        }
      });
    });
  });

  Lab.test('create file with text and spaces in file name PUT', function (done) {
    var filepath = baseFolder+'/test file.txt';
    var testText = "test";
    createFile(filepath, {content: testText}, function(err) {
      fs.readFile(filepath, {
        encoding: 'utf8'
      }, function (err, data) {
        if (err) {
          return done(err);
        } else if (!~data.indexOf(testText)) {
          return done(new Error('incorrect data'));
        } else {
          return done();
        }
      });
    });
  });

  Lab.test('create file in path that does not exist PUT', function (done) {
    var filepath = baseFolder+'/fake/test_file.txt';
    createFile(filepath,
      function (err, data) {
        if (err) {
          if (err.code === 'ENOENT') {
            return done();
          }
          return done(new Error('file should not have been created'));
        }
      });
  });

  Lab.test('overwrite file PUT', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    var testText = "test";
    var testText2 = "wonder";
    createFile(filepath, {content: testText}, function(err) {
      createFile(filepath, {content: testText2}, function(err) {
        fs.readFile(filepath, {
          encoding: 'utf8'
        }, function (err, data) {
          if (err) {
            return done(err);
          } else if (!~data.indexOf(testText2)) {
            return done(new Error('incorrect data'));
          } else {
            return done();
          }
        });
      });
    });
  });

});

function rmFile(path, cb) {
  supertest(server)
        .del(path)
        .end(function(err, res){
          if (err) {
            return cb(err);
          } else if (200 !== res.statusCode) {
            return cb(err, res);
          }
          fs.stat(path, function (err, stats) {
            if (err) {
              if (err.code === 'ENOENT') {
                return cb();
              }
              return cb(err);
            } else {
              return cb(new Error('file did not get deleted'));
            }
          });
      });
}
Lab.experiment('basic delete tests', function () {
  Lab.beforeEach(function (done) {
    cleanBase(done);
  });

  Lab.test('delete file', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    createFile(filepath, function(err) {
      if (err) {
        return done(err);
      }
      rmFile(filepath, done);
    });
  });

  Lab.test('delete file with trailing slash', function (done) {
    var filepath = baseFolder+'/test_file.txt';
    createFile(filepath, function(err) {
      if (err) {
        return done(err);
      }
      rmFile(filepath + '/', function (err, res) {
        if (err) { return done(err); }
        Lab.expect(res.statusCode).to.equal(404);
        done();
      });
    });
  });

  Lab.test('delete file that does not exist', function (done) {
    rmFile(baseFolder+'/fake.txt', function (err, res) {
      if (err) {
        return done(err);
      }
      Lab.expect(res.statusCode).to.equal(404);
      return done();
    });
  });

  Lab.test('try to delete folder', function (done) {
    rmFile(baseFolder, function (err, res) {
      if (err) {
        return done(err);
      }
      Lab.expect(res.statusCode).to.equal(403);
      return done();
    });
  });
});

Lab.experiment('read tests', function () {
  var file1path = baseFolder+'/test_file1.txt';
  var file2path = baseFolder+'/test_file2.txt';
  var fileContent = "test";

  Lab.before(function (done) {
    async.series([
      function(cb) {
        cleanBase(cb);
      },
      function(cb) {
        createFile(file1path, cb);
      },
      function(cb) {
        createFile(file2path, {content: fileContent}, cb);
      }
    ], done);
  });
  
  Lab.after(function (done) {
    cleanBase(done);
  });

  Lab.test('read file', function (done) {
    supertest(server)
      .get(file2path)
      .expect(200)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (!~fileContent.indexOf(res.text)) {
          return done(new Error('file read wrong data'));
        }
        return done();
      });
  });

  Lab.test('read file utf8', function (done) {
    supertest(server)
      .get(file2path)
      .query({encoding: 'utf8'})
      .expect(200)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (!~fileContent.indexOf(res.text)) {
          return done(new Error('file read wrong data'));
        }
        return done();
      });
  });

  Lab.test('read empty file', function (done) {
    supertest(server)
      .get(file1path)
      .expect(200)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (res.text !== "") {
          return done(new Error('file should be empty'));
        }
        return done();
      });
  });

  Lab.test('read file with redirect', function (done) {
    supertest(server)
      .get(file2path+'/')
      .expect(303)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (!~res.text.indexOf('Redirecting to '+file2path)) {
          return done(new Error('not redirecting'));
        }
        return done();
      });
  });

  Lab.test('read empty file with redirect', function (done) {
    supertest(server)
      .get(file1path+'/')
      .expect(303)
      .end(function(err, res){
        if (err) {
          return done(err);
        } else if (!~res.text.indexOf('Redirecting to '+file1path)) {
          return done(new Error('not redirecting'));
        }
        return done();
      });
  });

  Lab.test('read file that does not exist', function (done) {
    supertest(server)
      .get(file1path+'.fake.txt')
      .expect(404)
      .end(function(err, res){
        if (err) {
          return done(err);
        }
        return done();
      });
  });
});

Lab.experiment('move tests', function () {
  var dir1path =  baseFolder+'/test_dir1/';
  var dir2path =  baseFolder+'/test_dir2/';
  var file1path = baseFolder+'/test_file1.txt';
  var file2path = baseFolder+'/test_file2.txt';
  var fileContent = "test";

  Lab.before(function (done) {
    async.series([
      function(cb) {
        createDir(dir1path, cb);
      },
      function(cb) {
        createDir(dir2path, cb);
      },
      function(cb) {
        createFile(file1path, cb);
      },
      function(cb) {
        createFile(file2path, {content: fileContent}, cb);
      }
    ], done);
  });
  Lab.after(function (done) {
    cleanBase(done);
  });

  Lab.test('move file in same directory (rename)', function (done) {
    moveFile(file1path, file1path+'.test', false, false, done);
  });

  Lab.test('move file into directory', function (done) {
    moveFile(file1path+'.test', dir1path+'/test_file1.txt.test', false, false, done);
  });

  Lab.test('move file into another directory', function (done) {
    moveFile(dir1path+'/test_file1.txt.test', dir2path+'/test_file1.txt.test', false, false, done);
  });

  Lab.test('move file out of directory', function (done) {
    moveFile(dir2path+'/test_file1.txt.test', file1path, false, false, done);
  });

  Lab.test('move file over existing file', function (done) {
    moveFile(file1path, file2path, false, false, function(err) {
      if(err) {
        if(err.code === 'EEXIST') {
          return done();
        }
        return done(err);
      }
      return done(new Error('file was not supposed to be moved'));
    });
  });

  Lab.test('move file over existing file with clobber', function (done) {
    moveFile(file1path, file2path, true, false, done);
  });

  Lab.test('move file to nonexisting path', function (done) {
    moveFile(file2path, baseFolder+'/fake/path.txt', false, false, function(err) {
      if(err) {
        if(err.code === 'ENOENT') {
          return done();
        }
        return done(err);
      }
      return done(new Error('file was not supposed to be moved'));
    });
  });

  Lab.test('move file to nonexisting path with clober', function (done) {
    moveFile(file2path, baseFolder+'/fake/path.txt', true, false, function(err) {
      if(err) {
        if(err.code === 'ENOENT') {
          return done();
        }
        return done(err);
      }
      return done(new Error('file was not supposed to be moved'));
    });
  });

  Lab.test('move file to nonexisting path with mkdirp', function (done) {
    moveFile(file2path, baseFolder+'/new/test.txt', false, true, done);
  });
});
