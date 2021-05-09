/**
 * Load server
 */

'use strict';


/* Dependencies */
const path = require('path');
const { Cluster } = require('../lib/Cluster');
const Response = require('../lib/Response');
const SaplingError = require('../lib/SaplingError');

const { App: TinyHTTP } = require('@tinyhttp/app');
const sirv = require('sirv');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');
const compression = require('compression');
const csrf = require('csurf');


/**
 * Configure the Express server from the config data.
 *
 * @param {object} opts Options for reload and listen
 * @param {function} next Chain callback
 */
module.exports = function ({ reload, listen }, next) {
	let server;

	if (reload && this.server) {
		this.routeStack = { get: [], post: [], delete: [] };
		// This.server.routes = server._router.map;
		// this.server.stack.length = 2;
	} else {
		server = new TinyHTTP();
		this.routeStack = { get: [], post: [], delete: [] };
	}


	/* Compress if requested */
	if (this.config.compression) {
		server.use(compression());
	}

	/* Use the app secret from config, or generate one if needed */
	const secret = this.config.secret || (this.config.secret = this.utils.randString());
	server.use(cookieParser(secret));


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
			this.config.publicDir = [this.config.publicDir];
		}

		/* Loop through it */
		for (const publicDir of this.config.publicDir) {
			const publicDirPath = path.join(this.dir, publicDir);
			server.use(`/${publicDir}`, sirv(publicDirPath, { maxAge: 1 }));
		}
	}


	server.use(bodyParser.urlencoded({ extended: true }));
	server.use(bodyParser.json());
	server.use(logger(Cluster.logger));


	/* Use CSRF protection if enabled or in strict mode */
	if (this.config.csrf || this.config.strict) {
		server.use(csrf({ cookie: false }));

		server.use((error, request, response, next) => {
			if (error.code !== 'EBADCSRFTOKEN') {
				return next(error);
			}

			new Response(this, request, response, new SaplingError('Invalid CSRF token'));
		});
	}

	/* Enable the /data data interface */
	server.use('/data/', ({ method }, response, n) => {
		/* Send CORS headers if explicitly enabled in config */
		if (this.config.cors === true) {
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
		if (this.config.cors) {
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

	if (next) {
		next();
	}
};
