#!/bin/sh

WD="$(pwd)"

case "$1" in
"create")
	echo "Creating a new Sapling project."
	read -p "App name (e.g. My Cool App): " name
	read -p "Repository name (e.g. mycoolapp): " repo

	mkdir "$repo"
	cd "$repo"
	mkdir views
	mkdir models
	mkdir public
	mkdir public/js
	mkdir public/css
	mkdir public/images

	echo "{
	\"name\": \"$name\",
	\"dependencies\": {
		\"saplingjs\": \"*\"
	}
}" > package.json
	echo "{
	\"name\": \"$name\"
}" > config.json

	echo "{}" > routes.json	
	echo "{}" > permissions.json

	npm install
	;;

"serve" | "s")
	node ./index.js
	;;

"link")
	MY_PATH="`dirname \"$0\"`"
	MY_PATH="`( cd \"$MY_PATH\" && pwd )`"

	if [ -z "$MY_PATH" ] ; then
		echo "Link destination not found"
		exit 1
	fi

	rm -f /usr/local/bin/sapling
	ln -s $MY_PATH/sapling.sh /usr/local/bin/sapling
	;;

"console")
	echo "
		var repl = require(\"repl\");
		var App = require(\"./sapling/app\");

		var app = new App(__dirname, {listen: false});

		var sapling = repl.start({
			prompt: \"App (\"+app.config.name+\"): \",
			input: process.stdin,
			output: process.stdout
		});

		sapling.context.app = app;
	" | node;
	;;

esac
