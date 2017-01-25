#!/bin/sh

WD="$(pwd)"

case "$1" in
"init")
	echo "init"
	mkdir views
	mkdir models
	mkdir public
	mkdir public/js
	mkdir public/css
	mkdir public/images
	echo "{\"name\":\"My New Sapling App\"}" > config.json
	echo "{}" > controller.json	
	echo "{}" > permissions.json
	;;

"serve" | "s")
	node ./sapling
	;;

"modules")
	cd sapling/
	npm install 
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

"admin")
	read -p "Username: " username
	read -s -p "Password: " password

	echo "
		var app = require(\"./sapling/app\");
		a = new app(__dirname, {listen: false});

		a.register({
			session: app.adminSession,
			body: {
				name: \"$username\",
				pass: \"$password\",
				role: \"admin\"
			}
		}, {json: function(){ console.error(arguments); process.exit(0); }});
	" | node >/dev/null;
	;;

esac
