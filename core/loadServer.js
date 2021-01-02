/**
 * Load server
 */

'use strict';


/* Dependencies */
const fs = require('fs');
const path = require('path');
const { Cluster } = require('../lib/Cluster');

const express = require('express');
const session = require('express-session');
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
module.exports = function ({ reload, listen }, next) {
	let server;
	const self = this;

	if (reload && this.server) {
		this.routeStack = { get: [], post: [], delete: [] };
		// This.server.routes = server._router.map;
		// this.server.stack.length = 2;
	} else {
		server = express();
		this.routeStack = { get: [], post: [], delete: [] };
	}


	/* Use the app secret from config, or generate one if needed */
	const secret = this.config.secret || (this.config.secret = this.utils.randString());
	server.use(cookieParser(secret));


	/* Allow file uploads */
	server.use(fileUpload({
		useTempFiles: true
	}));

	/* Ensure the upload directory exists */
	this.uploadDir = path.join(this.dir, this.config.upload.destination);
	if (!fs.existsSync(this.uploadDir)) {
		fs.mkdirSync(this.uploadDir);
	}


	/* Persist sessions through reload */
	if (!server.sessionHandler) {
		/* Set session options */
		const sessionConfig = {
			secret,
			resave: false,
			saveUninitialized: true,
			cookie: { maxAge: null }
		};

		/* If we've defined a type, load it */
		if ('type' in this.config.sessionStore && this.config.sessionStore.type !== null) {
			const Store = require(this.config.sessionStore.type)(session);
			sessionConfig.store = new Store(this.config.sessionStore.options);
		}

		/* Create session handler */
		server.sessionHandler = session(sessionConfig);
	}

	server.use(server.sessionHandler);


	/* Handle the directory for our static resources */
	if ('publicDir' in this.config) {
		/* If it's a string, coerce into an array */
		if (Array.isArray(this.config.publicDir) === false) {
			this.config.publicDir = [ this.config.publicDir ];
		}

		/* Loop through it */
		this.config.publicDir.forEach(publicDir => {
			const publicDirPath = path.join(self.dir, publicDir);
			server.use(`/${publicDir}`, express.static(publicDirPath, { maxAge: 1 }));
		});
	}

	server.use(bodyParser.urlencoded({ extended: true }));
	server.use(bodyParser.json());
	server.use(logger(Cluster.logger));

	/* Enable the /data data interface */
	server.use('/data/', ({ method }, response, n) => {
		/* Send CORS headers if explicitly enabled in config */
		if (self.config.cors === true) {
			response.header('Access-Control-Allow-Origin', '*');
			response.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
			response.header('Access-Control-Allow-Headers', 'Content-Type');
		}

		/* Handle preflight requests */
		if (method === 'OPTIONS') {
			return response.sendStatus(200);
		}

		n();
	});

	/* Define the /api interface */
	server.use('/api/', (request, response, n) => {
		/* Send CORS headers if explicitly enabled in config */
		if (self.config.cors) {
			response.header('Access-Control-Allow-Origin', '*');
			response.header('Access-Control-Allow-Methods', 'GET,POST');
			response.header('Access-Control-Allow-Headers', 'Content-Type');
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
