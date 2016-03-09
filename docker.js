/**
 * Docker client
 * @module docker
 */
'use strict'

var Dockerode = require('dockerode')
var defaults = require('101/defaults')
var extend = require('101/assign')
var fs = require('fs')
var join = require('path').join
var url = require('url')

var error = require('debug')('rest-fs:docker')

// try/catch is a better pattern for this, since checking to see if it exists
// and then reading files can lead to race conditions (unlikely, but still)
var certs = {}
try {
  // DOCKER_CERT_PATH is docker's default thing it checks - may as well use it
  var certPath = process.env.DOCKER_CERT_PATH || '/etc/ssl/docker'
  certs.ca = fs.readFileSync(join(certPath, '/ca.pem'))
  certs.cert = fs.readFileSync(join(certPath, '/cert.pem'))
  certs.key = fs.readFileSync(join(certPath, '/key.pem'))
} catch (e) {
  error('cannot load certificates for docker!!')
  // use all or none - so reset certs here
  certs = {}
}

module.exports = Docker

/**
 * @param {Object} opts - docker options
 */
function Docker (opts) {
  opts = defaults(opts, {
    // host: process.env.DOCKER_HOST
    host: 'localhost',
    port: '2375'
  })
  // var dockerHost = opts.host
  //
  // var parsed = url.parse(dockerHost)
  // this.dockerHost = parsed.protocol + '//' + parsed.host
  // this.port = parsed.port
  // var dockerodeOpts = defaults(opts, {
  //   host: 'localhost',
  //   port: 2375
  //   // timeout: process.env.DOCKER_TIMEOUT
  // })
  extend(opts, certs)
  console.log('hello', opts)
  this.docker = new Dockerode(opts)
}



/**
 * returns stream of a bash session inside of a container
 * @param {String} containerId - docker container Id
 * @param {Function} cb (err, stream)
 */
Docker.prototype.execContainer = function (containerId, command, cb) {
  var options = {
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    Cmd: command
  }
  var self = this
  self.docker
    .getContainer(containerId)
    .exec(options, function (err, exec) {
      if (err) {
        return cb(err)
      }
      exec.start({ stdin: true }, function (startErr, stream) {
        if (startErr) {
          return cb(startErr)
        }
        cb(null, stream)
      })
    })
}
