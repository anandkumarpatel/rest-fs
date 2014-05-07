TEST_ROOT_DIR=`echo "$(pwd)/test_folder"`

# create files and folders
echo make test folder
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/"`
[[ "$OUT" == 'OK' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
[[ -d "$TEST_ROOT_DIR/" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo make empty folder
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/empty_dir/"`
[[ "$OUT" == 'OK' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
[[ -d "$TEST_ROOT_DIR/" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'

echo create file with data
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/new_file" -d '{"content":"this is a test file"}' -H "Content-Type: application/json"`
[[ "$OUT" == 'OK' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
[[ -e "$TEST_ROOT_DIR/new_file" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'

echo create file with no data
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/new_empty_file" `
[[ "$OUT" == 'OK' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
[[ -e "$TEST_ROOT_DIR/new_empty_file" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'


echo normal dir read
OUT=`curl -s "localhost:3000$TEST_ROOT_DIR/"`
TEST=`echo '[{"name":"empty_dir","path":"'$TEST_ROOT_DIR'/","isDir":true},{"name":"new_empty_file","path":"'$TEST_ROOT_DIR'/","isDir":false},{"name":"new_file","path":"'$TEST_ROOT_DIR'/","isDir":false}]'`
[[ "$OUT" ==  "$TEST" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo should redirect
OUT=`curl -s -L "localhost:3000$TEST_ROOT_DIR"`
[[ "$OUT" == "$TEST" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo normal empty dir read
OUT=`curl -s "localhost:3000$TEST_ROOT_DIR/empty_dir/"`
[[ "$OUT" == '[]' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo empty dir should redirect
OUT=`curl -s -L "localhost:3000$TEST_ROOT_DIR/empty_dir"` 
[[ "$OUT" == '[]' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'


echo fake dir read
OUT=`curl -s "localhost:3000$TEST_ROOT_DIR/nodir/"`
TEST=`echo '{"errno":34,"code":"ENOENT","path":"'$TEST_ROOT_DIR'/nodir/"}'`
[[ "$OUT" == "$TEST" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo file read
OUT=`curl -s "localhost:3000$TEST_ROOT_DIR/new_file"`
[[ "$OUT" == 'this is a test file' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo file no data read
OUT=`curl -s "localhost:3000$TEST_ROOT_DIR/new_empty_file"`
[[ "$OUT" == '' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo non existing file
OUT=`curl -s "localhost:3000$TEST_ROOT_DIR/nofile"`
TEST=`echo '{"errno":34,"code":"ENOENT","path":"'$TEST_ROOT_DIR'/nofile"}'`
[[ "$OUT" == "$TEST" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'


echo move file same dir
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/new_file" -d '{"newPath":"'$TEST_ROOT_DIR'/moved_new_file"}' -H "Content-Type: application/json"`
[[ -e "$TEST_ROOT_DIR/moved_new_file" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo move file diff dir
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/moved_new_file" -d '{"newPath":"'$TEST_ROOT_DIR'/fake/moved_new_file"}' -H "Content-Type: application/json"`
[[ ! -e "$TEST_ROOT_DIR/fake/moved_new_file" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo move file diff dir with mkdirp
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/moved_new_file" -d '{"newPath":"'$TEST_ROOT_DIR'/fake/moved_new_file", "mkdirp":true}' -H "Content-Type: application/json"`
[[ -e "$TEST_ROOT_DIR/fake/moved_new_file" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo move file to existing file
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/fake/moved_new_file" -d '{"newPath":"'$TEST_ROOT_DIR'/new_empty_file"}' -H "Content-Type: application/json"`
[[ -e "$TEST_ROOT_DIR/fake/moved_new_file" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo move file to existing file with clober
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/fake/moved_new_file" -d '{"newPath":"'$TEST_ROOT_DIR'/new_empty_file", "clobber":true}' -H "Content-Type: application/json"`
[[ ! -e "$TEST_ROOT_DIR/fake/moved_new_file" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'


echo move dir same dir
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/empty_dir" -d '{"newPath":"'$TEST_ROOT_DIR'/moved_dir"}' -H "Content-Type: application/json"`
[[ -d "$TEST_ROOT_DIR/moved_dir" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo move dir diff dir
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/moved_dir" -d '{"newPath":"'$TEST_ROOT_DIR'/fake_dir/moved_dir"}' -H "Content-Type: application/json"`
[[ ! -d "$TEST_ROOT_DIR/fake_dir/moved_dir" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo move dir diff dir with mkdirp
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/moved_dir" -d '{"newPath":"'$TEST_ROOT_DIR'/fake_dir/moved_dir", "mkdirp":true}' -H "Content-Type: application/json"`
[[ -d "$TEST_ROOT_DIR/fake_dir/moved_dir" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo move dir to existing dir
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/fake_dir/moved_dir" -d '{"newPath":"'$TEST_ROOT_DIR'/fake"}' -H "Content-Type: application/json"`
[[ -d "$TEST_ROOT_DIR/fake_dir/moved_dir" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
echo move dir to existing dir with clober
OUT=`curl -s -X POST "localhost:3000$TEST_ROOT_DIR/fake_dir/moved_dir" -d '{"newPath":"'$TEST_ROOT_DIR'/moved_dir2", "clobber":true}' -H "Content-Type: application/json"`
[[ ! -d "$TEST_ROOT_DIR/fake_dir/moved_dir" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'


echo delete file
OUT=`curl -s -X DELETE "localhost:3000$TEST_ROOT_DIR/new_file" `
[[ "$OUT" == 'OK' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
[[ ! -e "$TEST_ROOT_DIR/new_file" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'

echo delete file
OUT=`curl -s -X DELETE "localhost:3000$TEST_ROOT_DIR/new_empty_file" `
[[ "$OUT" == 'OK' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
[[ ! -e "$TEST_ROOT_DIR/new_empty_file" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'

echo delete folder
OUT=`curl -s -X DELETE "localhost:3000$TEST_ROOT_DIR/empty_dir/" `
[[ "$OUT" == 'OK' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
[[ ! -e "$TEST_ROOT_DIR/empty_dir" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'

echo delete folder
OUT=`curl -s -X DELETE "localhost:3000$TEST_ROOT_DIR/" `
[[ "$OUT" == 'OK' ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'
[[ ! -e "$TEST_ROOT_DIR" ]] && echo '     pass' || echo '!!!!!!!!! FAIL !!!!!!!!!'