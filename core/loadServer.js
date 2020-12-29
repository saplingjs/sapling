/**
 * Load server
 */


/* Dependencies */
const fs = require("fs");
const path = require("path");
const { Cluster } = require("../lib/Cluster");

const express = require("express");
const session = require("express-session");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');
const fileUpload = require('express-fileupload');


/**
 * Configure the Express server from the config data.
 * 
 * @param {object} opts Options for reload and listen
 * @param {function} next Chain callback
 */
module.exports = function loadServer({reload, listen}, next) {
	let server;
	let self = this;

	if (reload && this.server) {
		this.routeStack = {'get': [], 'post': [], 'delete': []};
		//this.server.routes = server._router.map;
		//this.server.stack.length = 2;
	} else {
		server = express();
		this.routeStack = {'get': [], 'post': [], 'delete': []};
	}


	/* Use the app secret from config, or generate one if needed */
	let secret = this.config.secret || (this.config.secret = this.utils.randString());
	server.use(cookieParser(secret));


	/* Allow file uploads */
	server.use(fileUpload({
		useTempFiles: true
	}));

	/* Ensure the upload directory exists */
	this.uploadDir = path.join(this.dir, this.config.upload.destination);
	if (!fs.existsSync(this.uploadDir)){
		fs.mkdirSync(this.uploadDir);
	}


	/* Persist sessions through reload */
	if (!server.sessionHandler) {
		/* Set session options */
		let sessionConfig = {
			secret, 
			resave: false,
			saveUninitialized: true,
			cookie: {maxAge: null}
		};

		/* If we've defined a type, load it */
		if('type' in this.config.sessionStore && this.config.sessionStore.type !== null) {
			/* TODO: Potentially find a way to support additional setup code */
			/* i.e. connect-redis ^4.0.0 requires an external Redis client */
			const store = require(this.config.sessionStore.type)(session);
			sessionConfig.store = new store(this.config.sessionStore.options);
		}

		/* Create session handler */
		server.sessionHandler = session(sessionConfig);
	}
	server.use(server.sessionHandler);


	/* Handle the directory for our static resources */
	/* TODO: Make into a recursive function to reduce duplicated code */
	if (this.config.staticDir !== false) {
		/* If it's a string, surface it */
		if(typeof this.config.staticDir === 'string') {
			const staticDirDir = path.join(this.dir, this.config.staticDir);
			server.use(`/${this.config.staticDir}`, express.static(staticDirDir, { maxAge: 1 }));
		}

		/* If it's an array, loop through it */
		if(typeof this.config.staticDir === 'object') {
			this.config.staticDir.forEach(staticDir => {
				const staticDirDir = path.join(self.dir, staticDir);
				server.use(`/${staticDir}`, express.static(staticDirDir, { maxAge: 1 }));
			});
		}
	}

	server.use(bodyParser.urlencoded({ extended: true }));
	server.use(bodyParser.json());
	server.use(logger(Cluster.logger));

	/* Enable the /data data interface */
	server.use("/data/", ({method}, res, n) => {
		/* Send CORS headers if explicitly enabled in config */
		if(self.config.cors === true) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
			res.header("Access-Control-Allow-Headers", "Content-Type");
		}

		/* Handle preflight requests */
		if (method === "OPTIONS") {
			return res.sendStatus(200);
		}

		n();
	});

	/* Define the /api interface */
	server.use("/api/", (req, res, n) => {
		/* Send CORS headers if explicitly enabled in config */
		if(self.config.cors) {
			res.header("Access-Control-Allow-Origin", "*");
			res.header("Access-Control-Allow-Methods", "GET,POST");
			res.header("Access-Control-Allow-Headers", "Content-Type");
		}

		n();
	});
	
	/* Start listening on the given port */
	if (listen !== false) {
		Cluster.listening(this.config.port);
		server.http = server.listen(this.config.port);
	}

	this.server = server;
	next();
};