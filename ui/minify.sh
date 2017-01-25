#!/bin/sh

loc="./assets/src/"
if [ "$1" != "" ]; then
	loc=$1
fi

echo "IN $loc\n"

for i in `find $loc -name "*.js" -not -name "*.min.js"`; do
	echo "Found $i\n"
	uglifyjs -c drop_console=true -o "${i%.js}.min.js" $i
done;
