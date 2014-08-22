rest-fs
=====

restful interface to a filesystem

usage
=====
`npm install rest-fs`

to install

`npm start`

starts fileserver on port 3000

`npm test`

runs various file and folder test

`npm start`

starts server on port 3000 of your entire system

`LOG=true`
for access log

`DEBUG=*`
for debug info

```
app = require('express')();
restfs = require('rest-fs')
restfs(app);
app.listen(3000)
```
To use programmatically, pass in the app into restfs and it will add the routes.
you can attach a function to modifyOut to manipulate file output.
the function has one argument which is the full filepath and should return path to return

API
===


GET /path/to/dir/
-----------------
  list contents of directory

  *optional*<br>
  ?recursive = list recursively default false

  returns: list of full file or folder paths (trailing slash tells if dir)
  ```
  res.body = [ { "fullDirPath" }, ... ]
  ```

GET /path/to/file
-----------------
  returns contents of file<br>
  if dir, redirect to dir path

  *optional*<br>
  ?encoding = default utf8

  returns:
  res.body = { "file content" }


POST /path/to/file/or/dir
-------------------------
  creates or overwrites file<br>
  creates dir if it does not exist.<br>
  renames or moves file if newPath exists<br>

  *optional*<br>
  body.newpath = if exist, move/rename file to this location.<br>
  body.clobber = if true will overwrite dest files (default false)<br>
  body.mkdirp = if true will create path to new location (default false)<br>
  body.mode = permissions of file (defaults: file 438(0666) dir 511(0777))<br>
  body.encoding = default utf8

  *optional for stream*<br>
  query.clobber = overwrite if exist
  query.mode = permissions of file (defaults: file 438(0666) dir 511(0777))<br>
  query.encoding = default utf8

  returns: modified resource. (trailing slash tells if dir)
  ```
  req.body = { "fullFileOrDirPath" }
  ```

PUT /path/to/file
-----------------
  creates file

  *optional*<br>
  body.mode = permissions of file (438 default 0666 octal)<br>
  body.encoding = default utf8

  returns: modified resource (trailing slash tells if dir)
  ```
  req.body = { "fullFilePath" }
  ```

DEL /path/to/dir/
-----------------
  deletes folder<br>
  if file returns error

  returns:
  ```
  req.body = {}
  ```

DEL /path/to/file
-----------------
  deletes file<br>
  if folder returns error

  returns:
  ```
  req.body = {}
  ```