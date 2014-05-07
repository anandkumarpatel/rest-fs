rest-fs
=====

restful interface to a filesystem

usage
=====

`npm start`
starts fileserver on port 3000

`npm test`
runs various file and folder test

`app = require('rest-fs')`
app is a express application which has all the file system routes defined
the app is not in the listening state

API
===


GET
  /path/to/dir/
  list contents of directory
  
  return:
  [
    {
      "name" : "file1", // name of dir or file
      "path" : "/path/to/file", // path to dir or file 
      "dir" : false // true if directory
    },
  ]


GET
  /path/to/file
  return contents of file
  if dir, redirect to dir path

  ?encoding = default utf8

  return:
  content of specified file as Content-Type "text/html"


POST
  /path/to/file/or/dir
  creates or overwrites file
  creates dir if it does not exist.
  renames or moves file if newPath exists
  *optional*
  body.newpath = if exist, move/rename file to this location.
  body.clobber = if true will overwrite dest files (default false)
  body.mkdirp = if true will create path to new location (default false)

  body.mode = permissions of file (defaults: file 438(0666) dir 511(0777))
  body.encoding = default utf8

  return: nothing

PUT
  /path/to/file
  creates file
  *optional*
  body.mode = permissions of file (438 default 0666 octal)
  body.encoding = default utf8

  return: nothing

DEL
  /path/to/dir/
  deletes folder
  if file returns error

  return: nothing

DEL
  /path/to/file
  deletes file
  if folder returns error

  return: nothing