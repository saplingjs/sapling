/**
 * App
 * 
 * Initialises a Sapling instance and handles incoming requests
 */


/* System dependencies */
const path = require("path");
const async = require("async");
const rfs = require("fs");
const _ = require("underscore");
const cron = require("cron").CronJob;

/* Server dependencies */
const express = require("express");
const session = require("express-session");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');

/* Messaging depedencies */
const nodemailer = require('nodemailer');

/* Internal dependencies */
const Storage = require("./lib/Storage");
const Greenhouse = require("./greenhouse");
const Error = require("./lib/Error");
const pwd = require("./lib/Hash");
const { Cluster, console } = require("./lib/Cluster");
const User = require("./lib/User");


/* TODO: Move all this somewhere more sensible */
function randString () {
	return (`00000000${Math.random().toString(36).substr(2)}`).substr(-11);
}
let ERROR_CODE = 500;
let forgotTemplateHTML = _.template(rfs.readFileSync(path.join(__dirname, "/static/mail/lostpass.html")).toString());


/**
 * The App class
 */
class App {

	/**
	 * Load and construct all aspects of the app
	 * 
	 * @param {string} dir Directory for the site files
	 * @param {object} opts Optional options to override the defaults and filesystem ones
	 * @param {function} next Callback after initialisation
	 */
	constructor(dir, opts, next) {
		/* Global vars */
		this.dir = dir;
		opts = opts || {};
		this.opts = opts;
		
		/* Cache of rendered views */
		this._viewCache = {};

		/* Filesystem */
		this.fs = rfs;

		/* Define an admin session for big ops */
		this.adminSession = {
			user: { role: "admin" }
		};

		/* Load everything */
		async.series([
			callback => this.loadConfig(callback),
			callback => {
				if (opts.loadServer !== false)
					this.loadServer(opts, callback);
			},
			callback => {
				if (opts.loadModel !== false)
					this.loadModel(callback);
			},
			callback => {
				if (opts.loadPermissions !== false)
					this.loadPermissions(callback);
			},
			callback => {
				if (opts.loadController !== false)
					this.loadController(callback);
			},
			callback => {
				if (opts.loadViews !== false)
					this.loadHook(callback);
			},
			callback => {
				if (opts.loadAPI !== false)
					this.loadAPI(callback);
			},
			callback => {
				if (opts.loadViews !== false) {
					for (const route in this.controller) {
						this.initRoute(route, path.join(this.dir, this.config.views, this.controller[route]));
					}
				}
	
				if (opts.loadREST !== false)
					this.loadREST(callback);
			},
			callback => {
				if (opts.loadMailer !== false)
					this.loadMailer(callback);
			}
		], (err, results) => {
			if(err) {
				console.error("Error starting Sapling");
				console.error(err);
				console.error(err.stack);
				return false;
			}

			if(next) next();
		});
	}

	/*
	* Load the configuration data. Should exist in a file
	* called "config" and must be valid JSON.
	*/
	async loadConfig(next) {
		/* Default configuration values */
		const defaultConfig = {
			"models": "models",
			"views": "views",
			"autoRouting": "auto",
			"controller": "controller.json",
			"extension": "html",
			"secret": randString(),
			"staticDir": "public",
			"cacheViews": true,
			"showError": true,
			"strict": true,
			"production": "auto",
			"db": {
				"type": "Mongo"
			},
			"mailer": {
				"type": "SMTP",
				"service": "Gmail",
				"auth": {
					user: process.env.MAIL_USER,
					password: process.env.MAIL_PASS
				}
			},
			"port": this.opts.port || 8000,
			"cors": true,
			"url": ""
		};

		this.config = {};
		Object.assign(this.config, defaultConfig);

		/* Location of the configuration */
		const configPath = path.join(this.dir, "config.json");

		/* Load the configuration */
		if(this.fs.existsSync(configPath)) {
			/* If we have a config file, let's load it */
			let file = this.fs.readFileSync(configPath);

			/* Parse and merge the config, or throw an error if it's malformed */
			try {
				const c = JSON.parse(file.toString());
				_.extend(this.config, c);
			} catch (e) {
				console.error("Error loading config");
				console.error(e, e.stack);
			}
		} else {
			/* If not, let's add a fallback */
			_.extend(this.config, {"name": "untitled"});
		}

		/* Detect production environment */
		if(this.config.production === "auto" && process.env.NODE_ENV === "production") {
			this.config.production = true;
		}

		/* Set other config based on production */
		if(this.config.production === true || this.config.production === "on") {
			/* Check if there's a separate production config */
			const prodConfigPath = path.join(this.dir, `config.${process.env.NODE_ENV}.json`);
			
			if(this.fs.existsSync(prodConfigPath)) {
				/* If we have a config file, let's load it */
				let file = this.fs.readFileSync(prodConfigPath);
				
				this.config = {};
				Object.assign(this.config, defaultConfig);
	
				/* Parse and merge the config, or throw an error if it's malformed */
				try {
					const pc = JSON.parse(file.toString());
					_.extend(this.config, pc);
				} catch (e) {
					console.error("Error loading production config");
					console.error(e, e.stack);
				}
			}

			/* Set immutable production vars */
			this.config.strict = true;
			this.config.autoRouting = false;
			this.config.showError = false;
		}

		console.log("CONFIG", this.config);

		/* Set the app name */
		this.name = this.config.name;

		next();
	}

	/**
	 * Configure the Express server from the config data.
	 * 
	 * @param {function} next Chain callback
	 */
	loadServer({reload, listen}, next) {
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
		let secret = this.config.secret || (this.config.secret = randString());
		server.use(cookieParser(secret));


		/* Persist sessions through reload */
		if (!server.sessionHandler) {
			/* TODO: Implement non-Redis store  */
			const sessionStore = null;

			server.sessionHandler = session({
				store: sessionStore,
				secret, 
				resave: false,
				saveUninitialized: true,
				cookie: {maxAge: null}
			});
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
			if(self.config.cors) {
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
	}


	/**
	 * Get all files recursively from a given directory
	 * 
	 * @param {string} dir Directory path
	 */
	getFiles(dir) {
		let results = [];
		const list = this.fs.readdirSync(dir);

		list.forEach(file => {
			const dirfile = dir + '/' + file;
			const stat = this.fs.statSync(dirfile);
			if (stat && stat.isDirectory()) { 
				/* Recurse into a subdirectory */
				results = results.concat(this.getFiles(dirfile));
			} else { 
				/* Is a file */
				results.push(dirfile);
			}
		});

		return results;
	}


	/**
	 * Load the controller JSON file.
	 * 
	 * @param {function} next Chain callback
	 */
	async loadController(next) {
		/* Location of the controller file */
		const controllerPath = path.join(this.dir, this.config.controller);

		this.controller = {};

		/* Generate a controller from the available views */
		if(this.config.autoRouting === "on" || this.config.autoRouting === "auto" || this.config.autoRouting === true) {
			const viewsPath = path.join(this.dir, this.config.views);

			if(this.fs.existsSync(viewsPath)) {
				/* Load all views in the views directory */
				const views = this.getFiles(viewsPath);

				/* Go through each view */
				for (let i = 0; i < views.length; ++i) {
					const segments = views[i].split("/");

					/* Filter out the views where any segment begins with _ */
					const protectedSegments = segments.filter(item => {
						var re = /^\_/;
						return re.test(item);
					});

					if(protectedSegments.length)
						continue;
					
					/* Filter out filesystem bits */
					const view = views[i].replace(this.config.views, "").replace(`.${this.config.extension}`, "");
					const route = view.replace("/index", "");

					/* Create an automatic GET route for a given view */
					this.controller[route] = view;
				}
			}
		}

		/* Load the controller file */
		if(this.fs.existsSync(controllerPath)) {
			/* If we have a controller file, let's load it */
			let file = this.fs.readFileSync(controllerPath);

			/* Parse and merge the controller, or throw an error if it's malformed */
			try {
				if(this.config.autoRouting === "on") {
					Object.assign(this.controller, JSON.parse(file.toString()));
				} else {
					this.controller = JSON.parse(file.toString());
				}
			} catch (e) {
				console.error(`Controller at path: \`${controllerPath}\` could not be loaded.`);
			}
		}

		console.log("CONTROLLER", this.controller);

		/* Next stage of the setup */
		next();
	}

	/**
	 * Load the model structures and initialise
	 * the storage instance for this app.
	 * 
	 * @param {function} next Chain callback
	 */
	loadModel(next) {
		const modelPath = path.join(this.dir, this.config.models);
		let structure = {};

		if(this.fs.existsSync(modelPath)) {
			/* Load all models in the model directory */
			let files = this.fs.readdirSync(modelPath);

			/* Go through each model */
			for (let i = 0; i < files.length; ++i) {
				const file = files[i].toString();
				const table = file.split(".")[0];

				if (table == "") {
					files.splice(i--, 1);
					continue; 
				}

				const model = this.fs.readFileSync(path.join(modelPath, file));

				/* Read the model JSON into the structure */
				try {
					structure[table] = JSON.parse(model.toString());
				} catch (e) {
					console.error("Error parsing model `%s`", table);
				}
			}

			/* Create a storage instance based on the models */
			const storage = new Storage({
				name: this.name, 
				schema: structure,
				config: this.config,
				dir: this.dir
			});

			this.structure = structure;
			this.storage = storage;

		} else {
			console.warn(`Models at path \`${modelPath}\` does not exist`);
		}

		if(next) next();
	}

	/**
	 * Load the permissions file, and implement the middleware
	 * to validate the permission before continuing to the
	 * route handler.
	 * 
	 * @param {function} next Chain callback
	 */
	loadPermissions(next) {
		/* Load the permissions file */
		/* TODO: Provide fallback in case the file is missing or mangled */
		const permissionsPath = path.join(this.dir, "permissions.json");
		const perms = this.fs.readFileSync(permissionsPath);

		/* Try to parse it into JSON */
		try {
			this.permissions = JSON.parse(perms);
		} catch (e) {
			console.error(`permissions at path: [${permissionsPath}] not found.`);
			console.error(e);
			console.error(e.stack);
		}

		/* Loop over the urls in permissions */
		Object.keys(this.permissions).forEach(url => {
			/* Format expected: "GET /url/here" */
			const parts = url.split(" ");

			/* If we have more than two bits, skip it */
			if (parts.length < 2) {
				return;
			}

			/* First part is the method: get, post, delete */
			let method = parts[0].toLowerCase();
			/* Second part is the URL */
			const route = parts[1];

			/* The minimum role level required for this method+route combination */
			const role = this.permissions[url];

			const self = this;
			
			/* default method is `all`. */
			if (!["get", "post", "delete"].includes(method)) {
				method = "all";
			}

			/* Create middleware for each particular method+route combination */
			this.server[method](route, function (req, res, next) {
				console.log("PERMISSION", method, route, role);

				/* If the current route is not allowed for the current user, display an error */
				if (!self.isUserAllowed(req.permission, req.session.user)) {
					const errorHandler = self.errorHandler(req, res);
					return errorHandler([{message: "You do not have permission to complete this action."}]);
				} else next();
			});
			
		});
	
		if(next) next();
	}

	/**
	 * Load the given view from a file
	 * 
	 * @param {string} view Name of the view to be loaded
	 * @param {function} next Chain callback
	 */
	loadView(view, next) {
		/* Construct the path to the view */
		/* TODO: make smarter about the file extension */
		const viewPath = `${view}.${this.config.extension}`;

		/* If the given view exists, read the file and load it into the cache. Otherwise throw an error */
		if(this.fs.existsSync(viewPath)) {
			const template = this.fs.readFileSync(viewPath);
			this._viewCache[view] = template.toString();
		} else {
			console.error("Error loading the view template.", `[${viewPath}]`);
			console.error(`View template does not exist at: ${viewPath}`);
		}
	
		if(next) next();
	}

	/**
	 * Render a given view and send it to the browser.
	 * 
	 * @param {string} view The name of the view being rendered
	 * @param {object} data Query data
	 * @param {object} req Express req object
	 * @param {object} res Express res object
	 * @param {function} next Chain callback
	 */
	renderView(view, data, req, res, next) {
		const body = Object.keys(req.body).length ? req.body : null;

		/* Build the data to pass into template */
		_.extend(data, {
			params: _.extend({}, req.params), 
			query: req.query,
			headers: req.headers,
			session: req.session,
			form: body,
			"$_POST": body, // php-like alias
			"$_GET": req.query,
			self: {
				dir: path.join(this.dir, this.config.views),
				url: req.url,
				method: req.method,
				name: this.name
			}
		});

		if (this.opts.etc) {
			data.self.etc = this.opts.etc;
		}

		/* If the view hasn't been cached or views aren't cached at all, load the view */
		if (!this.config.cacheViews || !(view in this._viewCache)) {
			this.loadView(view);
		}
		
		/* Then, get the view from the internal cache */
		const template = this._viewCache[view];

		/* Create new template engine instance */
		const g = new Greenhouse(this.hooks, this.fs);
		const config = this.config;
		const dir = this.dir;

		/* Send a properly compiled page to the browser */
		g.oncompiled = html => {
			res.send(html);
		};

		/* Send an error to the console */
		g.onerror = error => {
			console.error(error);
		};

		/* Handle redirects */
		g.onredirect = url => {
			res.redirect(url);
		};

		/* Send JSON if we're doing JSON */
		g.onjson = data => {
			res.json(data);
		};

		/* Kick off the render */
		g.render(template, data);

		if(next) next();
	}

	/**
	 * Initialise the given route; load and render the view,
	 * create the appropriate listeners.
	 * 
	 * @param {string} route Name of the route to be loaded
	 * @param {function} view Chain callback
	 */
	initRoute(route, view) {
		console.log("Loaded route ", `${route}`)

		/* If the view is not in the cache, load it first */
		/* TODO: Isn't this sort of handled inside of renderView anyway? */
		if (!this._viewCache[view]) {
			this.loadView(view);
		}
		
		/* Create a handler for incoming requests */
		const self = this;
		const handler = (req, res) => {
			self.renderView(
				view, 
				{}, 
				req, 
				res, 
				self.errorHandler(req, res)
			);
		};

		/* Listen on both GET and POST with the same handler */
		this.server.get(route, handler);
		this.server.post(route, handler);

		/* Save the routes for later */
		this.routeStack.get.push(route);
		this.routeStack.post.push(route);
	}

	
	/**
	 * Get the defined permission role for a given method and route
	 * 
	 * @param {string} method One of "get", "post" or "delete"
	 * @param {string} url The route being tested
	 */
	getRoleForRoute(method, url) {
		const routes = this.routeStack[method];
		
		/* Go through all the routes */
		for (let i = 0; i < routes.length; ++i) {
			/* If the given route matches the url */
			/* TODO: Check how fragile this is for things like trailing slashes */
			if (routes[i] == url) {
				/* Find the given permission rule in the loaded permissionset */
				const permissionKey = `${method.toUpperCase()} ${routes[i]}`;
				const userType = this.permissions[permissionKey];

				/* Return the first match */
				if (userType) {
					return userType;
				}
			}
		}

		/* Default to anyone */
		return "anyone";
	}


	/**
	 * Check if the given user is permitted carry out a specific action
	 * for the given permission level
	 * 
	 * @param {string} permission The role level required for a given action
	 * @param {object} user The user object
	 */
	isUserAllowed(permission, user) {
		/* Stranger must NOT be logged in */
		if (permission === "stranger") {
			if (user) {
				return false;
			}
		}
		
		/* "member" or "owner" must be logged in */
		/* "owner" is handled further in the process */
		else if (permission === "member" || permission === "owner") {
			if (!user) {
				return false;
			}
		}

		/* Remove any restriction from "anyone" routes */
		else if (permission === "anyone") {
			return true;
		}

		/* Handle custom roles */
		else {
			const role = user && user.role || "stranger";
			return this.storage.inheritRole(role, permission);
		}

		/* Default to allowed */
		return true;
	}


	/**
	 * Setup hooks into the template parser to
	 * return data from the storage engine.
	 *
	 * @param {function} view Chain callback
	 */
	loadHook(next) {
		const self = this;
		this.hooks = {
			get(block, next) {
				//pause parsing and decode request
				const expr = block.expr.split(" ");
				
				const url = expr[0];
				let role = expr[1];
				// as = expr[2]
				let key = expr[3];
				
				// if role has been left out, use current user or stranger
				if (role == 'as') {
					role = false;
					key = expr[2];
				}

				const baseurl = url.split("?")[0];
				
				// see if this url has a permission associated
				const permission = self.getRoleForRoute("get", baseurl);

				// if no role is provided, use current
				const session = role ? { user: { role } } : this.data.session;

				const allowed = self.isUserAllowed(permission, session.user);
				console.log("IS ALLOWED", session, allowed, permission)

				// not allowed so give an empty array
				if (!allowed) {
					this.saveDots(key, []);
					return next();
				}

				//request the data then continue parsing
				self.storage.get({
					url, 
					permission, 
					session
				}, (err, data) => {
					if(err)
						console.error(err);

					this.saveDots(key, data);
					next();
				});
			},

			post(block, next) {
				// pause parsing and decode request
				const expr = block.expr.split(" ");
				
				const url = expr[0];
				const body = expr[1];
				let role = expr[2];
				// as = expr[3]
				let key = expr[4];

				// role has been left out
				if (role == 'as') {
					role = false;
					key = expr[3];
				}

				const baseurl = url.split("?")[0];
				
				// see if this url has a permission associated
				const permission = self.getRoleForRoute("post", baseurl);
				const session = role ? { user: { role } } : this.data.session;
				const allowed = self.isUserAllowed(permission, session.user);

				// not allowed so give an empty array
				if (!allowed) {
					return next();
				}

				// request the data then continue parsing
				self.storage.post({
					url: baseurl,
					body: this.extractDots(body),
					permission, 
					session
				}, (err, data) => {
					if(err)
						console.error(err);

					if (key) {
						this.saveDots(key, data);
					}

					next();
				});
			},

			debug({rawExpr, end}, next) {
				const value = this.extractDots(rawExpr);
				this.pieces.push(`<pre>${JSON.stringify(value, null, '\t')}</pre>`);
				this.start = end + 1;
				next();
			},

			redirect({expr}, next) {
				this.onredirect && this.onredirect.call(this, expr);
				return false;
			},

			error({expr}, next) {
				this.onerror && this.onerror.call(this, expr);
				return false;
			},

			json({rawExpr}, next) {
				const data = this.extractDots(rawExpr);
				this.onjson && this.onjson.call(this, data);
				return false;
			}
		};

		next();
	}


	/**
	 * Setup the endpoints for the /data interface
	 *
	 * @param {function} view Chain callback
	 */
	loadREST(next) {
		/* Direct user creation to a special case endpoint */
		this.server.post(/\/data\/users\/?$/, this.user.register);

		/* Otherwise, send each type of query to be handled by Storage */
		this.server.get("/data/*", (req, res) => {
			this.storage.get(req, this.response(req, res));
		});
		this.server.post("/data/*", (req, res) => {
			this.storage.post(req, this.response(req, res));
		});
		this.server.delete("/data/*", (req, res) => {
			this.storage.delete(req, this.response(req, res));
		});

		next();
	}


	/**
	 * Setup the endpoints for the /api interface for functionality
	 *
	 * @param {function} view Chain callback
	 */
	loadAPI(next) {
		this.user = new User(this);

		next();
	}


	/**
	 * Setup email sending functionality
	 *
	 * @param {function} view Chain callback
	 */
	loadMailer(next) {
		/* Load the config */
		const config = _.extend({}, this.config.mailer);

		/* Don't send type to nodemailer */
		const type = config.type;
		delete config.type;

		/* Create mailer if we have the necessary config */
		if(config.auth.username && config.auth.password)
			this.mailer = nodemailer.createTransport(type, config);

		next()
	}


	/**
	* Create a callback function handle a response
	* from the storage instance.
	*/
	response(req, res) {
		const self = this;

		return (err, response) => {
			if (err) {
				return self.errorHandler(req, res).call(self, err);
			}

			if (req.query.goto) {
				res.redirect(req.query.goto);
			}

			res.json(response);
		};
	}

	/**
	* Create an error handler function
	*/
	errorHandler(req, res) {
		const self = this;
		return err => {
			// no error to display
			if (!err) { return false; }

			const error = new Error(err);

			//log to the server
			console.error("Error occured during %s %s", req.method && req.method.toUpperCase(), req.url)
			if (self.config.showError) {
				console.error(err);
				if (err.stack) console.error(err.stack);
			}

			// if json or javascript in accept header, give back JSON
			const acceptJSON = /json|javascript/.test(req.headers.accept || "");

			// get the appropriate error code from the first error in stack
			ERROR_CODE = Number(error.template.errors[0].status);
			
			// render the error view
			if (self.config.errorView && !acceptJSON) {
				const errorPath = path.join(self.dir, self.config.views, self.config.errorView);

				self.loadView(errorPath);
				
				try {
					self.renderView.call(self, 
						errorPath, 
						{error: error.template}, 
						req, res,
						err => {
							// in case of error in error
							if (err) {
								res.status(ERROR_CODE).json(error.template)
							}
						}
					);
				} catch {
					res.status(ERROR_CODE).json(error.template)
				}
			} else {
				res.status(ERROR_CODE).json(error.template);
			}
		};
	}


	/**
	 * Reload the whole server (get new views, config, etc)
	 */
	reload() {
		console.log(`\n\n**** RESTARTING ****\n\n`);
	
		/* Don't attempt to listen on the same port again */
		this.opts.listen = false;
		this.opts.reload = true;

		/* Restart the server */
		App.call(this, this.config.name, this.opts, () => {
			console.log("RESTARTED");
		});
	}
}

module.exports = App;
