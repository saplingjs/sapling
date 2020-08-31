const path = require("path");
const util = require("util");
const async = require("async");
const ff = require("ff");
const rfs = require("fs");
const _ = require("underscore");
const cron = require("cron").CronJob;

const express = require("express");
const session = require("express-session");
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');

const nodemailer = require('nodemailer');

const Storage = require("./storage");
const Greenhouse = require("./greenhouse");
const Error = require("./lib/Error");
const pwd = require("./lib/Hash");
const Cluster = require("./lib/Cluster");

let stripe;

function randString () {
	return (`00000000${Math.random().toString(36).substr(2)}`).substr(-11);
}

let ERROR_CODE = 500;

let forgotTemplateHTML = _.template(rfs.readFileSync(path.join(__dirname, "/static/mail/lostpass.html")).toString());

class App {
	constructor(dir, opts, next) {
		this.dir = dir;
		opts = opts || {};
		this.opts = opts;
		
		this._viewCache = {};
		this._remoteAddrs = {};
		this._sockets = [];

		this.fs = rfs;
		this.dir = dir;

		/* Make core functions return Promises */
		this.readFile = util.promisify(this.fs.readFile);

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
				if (opts.loadViews !== false) {
					for (const route in this.controller) {
						this.initRoute(route, path.join(this.dir, this.config.views, this.controller[route]));
					}
				}
	
				if (opts.loadREST !== false)
					this.loadREST(callback);
			},
			callback => {
				if (opts.loadAPI !== false)
					this.loadAPI(callback);
			},
			callback => {
				if (opts.loadMailer !== false)
					this.loadMailer(callback);
			},
			callback => {
				this._restarting = false;
				callback();
			}
		], (err, results) => {
			if(err) {
				Cluster.console.error("Error starting Sapling");
				Cluster.console.error(err);
				Cluster.console.error(err.stack);
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
		this.config = {
			"models": "models",
			"views": "views",
			"controller": "controller.json",
			"extension": "html",
			"secret": randString(),
			"staticDir": "public",
			"cacheViews": true,
			"showError": true,
			"strict": true,
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
			"csrf": false,
			"cors": true,
			"rateLimit": 10,
			"url": ""
		};

		/* Location of the configuration */
		const configPath = path.join(this.dir, "config.json");

		/* Load the configuration */
		if(this.fs.existsSync(configPath)) {
			/* If we have a config file, let's load it */
			let file = await this.readFile(configPath);

			/* Parse and merge the config, or throw an error if it's malformed */
			try {
				const c = JSON.parse(file.toString());
				_.extend(this.config, c);
			} catch (e) {
				Cluster.console.error("Error loading config");
				Cluster.console.error(e, e.stack);
			}
		} else {
			/* If not, let's add a fallback */
			_.extend(this.config, {"name": "untitled"});
		}

		/* Set the app name */
		this.name = this.config.name;

		/* Next stage of the setup */
		next();
	}

	/**
	 * Configure the Express server from the config data.
	 * 
	 * @param {function} next Chain callback
	 */
	loadServer({reload, listen}, next) {
		let server;
		let secret = this.config.secret || (this.config.secret = randString());
		let self = this;

		if (reload && this.server) {
			this.routeStack = {'get': [], 'post': [], 'delete': []};
			//this.server.routes = server._router.map;
			//this.server.stack.length = 2;
		} else {
			server = express();
			this.routeStack = {'get': [], 'post': [], 'delete': []};
		}

		/* Add a rate limiter if necessary */
		if (this.config.strict) {
			server.use((req, res, next) => {
				if (req.method.toLowerCase() !== "post") { return next(); }

				const ip = req.headers['x-real-ip'] || req.ip;
				if (!ip || ip == "127.0.0.1") { return next(); }

				// currently blocked
				if (self._remoteAddrs[ip] === true) {
					return res.status(420).json([{message: `Sending too many requests from \`${ip}\`.`}]);
				}

				self._remoteAddrs[ip] = true;
				setTimeout(() => {
					delete self._remoteAddrs[ip];
				}, self.config.rateLimit * 1000);

				next();
			});
		}

		server.use(cookieParser(secret));

		// to persist sessions through reload
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

		if (this.config.staticDir !== false) {
			if(typeof this.config.staticDir === 'string') {
				const staticDirDir = path.join(this.dir, this.config.staticDir);
				server.use(`/${this.config.staticDir}`, express.static(staticDirDir, { maxAge: 1 }));
			} 
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

		if (this.config.stripe) {
			stripe = require('stripe')(this.config.stripe.api_key)
		}

		// enable CORS
		server.use("/data/", ({method}, res, n) => {
			if(self.config.cors) {
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
				res.header("Access-Control-Allow-Headers", "Content-Type");
			}

			// preflight request
			if (method === "OPTIONS") {
				return res.sendStatus(200);
			}

			n();
		});
		server.use("/api/", (req, res, n) => {
			if(self.config.cors) {
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Methods", "GET,POST");
				res.header("Access-Control-Allow-Headers", "Content-Type");
			}

			n();
		});
		
		if (listen !== false) {
			Cluster.listening(this.config.port);
			server.http = server.listen(this.config.port);
		}

		this.server = server;
		next();
	}

	/**
	 * Load the controller JSON file.
	 * 
	 * @param {function} next Chain callback
	 */
	async loadController(next) {
		/* Location of the controller file */
		const controllerPath = path.join(this.dir, this.config.controller);

		/* Load the controller */
		if(this.fs.existsSync(controllerPath)) {
			/* If we have a controller file, let's load it */
			let file = await this.readFile(controllerPath);

			/* Parse and merge the controller, or throw an error if it's malformed */
			try {
				this.controller = JSON.parse(file.toString());
			} catch (e) {
				Cluster.console.error(`Controller at path: \`${controllerPath}\` could not be loaded.`);
			}
		} else {
			/* If not, let's use a fallback */
			this.controller = {};
		}

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
		const structure = {};

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
					Cluster.console.error("Error parsing model `%s`", table);
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
			Cluster.console.warn(`Models at path \`${modelPath}\` does not exist`);
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
		const permissionsPath = path.join(this.dir, "permissions.json");

		const perms = this.fs.readFileSync(permissionsPath);

		try {
			this.permissions = JSON.parse(perms);
		} catch (e) {
			Cluster.console.error(`permissions at path: [${permissionsPath}] not found.`);
			Cluster.console.error(e);
			Cluster.console.error(e.stack);
		}

		// loop over the urls in permissions
		Object.keys(this.permissions).forEach(url => {
			const parts = url.split(" ");
			if (parts.length < 2) {
				return; //permissions could potentially have >2 params
			}

			let method = parts[0].toLowerCase();
			const route = parts[1];
			const user = this.permissions[url];

			const self = this;
			
			// default method is `all`.
			if (!["get", "post", "delete"].includes(method)) {
				method = "all";
			}

			this.server[method](route, function (req, res, next) {
				Cluster.console.log(`${this.workerID()}PERMISSION`, method, route, user);
				
				// make sure users don't accidently lock themselves out
				// of the admin login
				if (req.url.indexOf("/api/login") === 0) {
					return next();
				}

				let flag = false;

				//save the required permission and pass it on
				req.permission = user;

				//stranger must NOT be logged in
				if (user === "stranger") {
					if (req.session && req.session.user) {
						flag = true;
					}
				}
				//member or owner must be logged in
				//owner is handled further in the process
				else if (user === "member" || user === "owner") {
					if (!req.session.user) {
						flag = true;
					}
				}
				//no restriction
				else if (user === "anyone") {
					flag = false;
				}
				//custom roles
				else {
					const role = req.session.user && req.session.user.role || "stranger";
					flag = !self.storage.inheritRole(role, user);
				}

				if (flag) {
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
			Cluster.console.error("Error loading the view template.", `[${viewPath}]`);
			Cluster.console.error(`View template does not exist at: ${viewPath}`);
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
			Cluster.console.error(error);
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
		Cluster.console.log("Loaded route ", `${route}`)

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

	testRoute(method, url) {
		const routes = this.routeStack[method];
		
		for (let i = 0; i < routes.length; ++i) {
			//see if this route matches
			if (routes[i] == url) {
				const permissionKey = `${method.toUpperCase()} ${routes[i]}`;
				const userType = this.permissions[permissionKey];

				//return the first matching type
				if (userType) {
					return userType;
				}
			}
		}

		//default to anyone
		return "anyone";
	}

	testPermission(permission, user) {
		//stranger must NOT be logged in
		if (permission === "stranger") {
			if (user) {
				return false;
			}
		}
		//member or owner must be logged in
		//owner is handled further in the process
		else if (permission === "member" || permission === "owner") {
			if (!user) {
				return false;
			}
		}
		//no restriction
		else if (permission === "anyone") {
			return true;
		}
		//custom roles
		else {
			const role = user && user.role || "stranger";
			return this.storage.inheritRole(role, permission);
		}

		return true;
	}

	/**
	* Setup hooks into the template parser to
	* return data from the storage engine.
	*/
	loadHook(next) {
		const app = this;
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
				const permission = app.testRoute("get", baseurl);

				// if no role is provided, use current
				const session = role ? { user: { role } } : this.data.session;

				const allowed = app.testPermission(permission, session.user);
				Cluster.console.log(`${this.workerID()}\n\nIS ALLOWED`, session, allowed, permission)

				// not allowed so give an empty array
				if (!allowed) {
					this.saveDots(key, []);
					return next();
				}

				//request the data then continue parsing
				app.storage.get({
					url, 
					permission, 
					session
				}, (err, data) => {
					if(err)
						Cluster.console.error(err);

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
				const permission = app.testRoute("post", baseurl);
				const session = role ? { user: { role } } : this.data.session;
				const allowed = app.testPermission(permission, session.user);

				// not allowed so give an empty array
				if (!allowed) {
					return next();
				}

				// request the data then continue parsing
				app.storage.post({
					url: baseurl,
					body: this.extractDots(body),
					permission, 
					session
				}, (err, data) => {
					if(err)
						Cluster.console.error(err);

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
	* Setup the endpoints for the REST interface
	* to the model.
	*/
	loadREST(next) {
		//don't use the default REST api for creating a user
		this.server.post(/\/data\/users\/?$/, this.register.bind(this));

		//rest endpoints
		this.server.get("/data/*", this.handleGET.bind(this));
		this.server.post("/data/*", this.handlePOST.bind(this));
		this.server.delete("/data/*", this.handleDELETE.bind(this));

		next();
	}

	loadAPI(next) {
		//api endpoints
		this.server.get("/api/logged", this.getLogged.bind(this));
		this.server.post("/api/login", this.login.bind(this));
		this.server.post("/api/update", this.update.bind(this));
		this.server.post("/api/forgot", this.forgot.bind(this));
		this.server.get("/api/logout", this.logout.bind(this));
		this.server.get("/api/recover", this.recover.bind(this));
		this.server.post("/api/register", this.register.bind(this));

		next();
	}

	loadMailer(next) {
		const config = _.extend({}, this.config.mailer);
		const type = config.type;
		delete config.type;

		if(config.auth.username && config.auth.password)
			this.mailer = nodemailer.createTransport(type, config);

		next()
	}

	/**
	* REST handlers
	*/
	handleGET(req, res) {
		//forward the request to storage
		this.storage.get(req, this.response(req, res));
	}

	handlePOST(req, res) {
		//forward the post data to storage
		this.storage.post(req, this.response(req, res));
	}

	handleDELETE(req, res) {
		this.storage.delete(req, this.response(req, res));
	}

	/**
	* In-built user account functionality.
	*/
	getLogged(req, res) {
		if (req.session && req.session.user) {

			if (req.query.reload) {
				// reload the user object
				this.storage.get({
					url: `/data/users/_id/${req.session.user._id}/?single=true`,
					session: req.session
				}, (err, user) => {
					req.session.user = _.extend({}, user);
					delete req.session.user.password;
					delete req.session.user._salt;
					res.json(req.session.user);
				});
			} else {
				res.json(req.session.user); 
			}
		} else {
			res.json(false);
		}
	}

	login(req, res) {

		const url = `/data/users/email/${req.body.email}`;
		const permission = this.testRoute("get", url);

		const f = ff(this, function () {
			this.storage.db.read("users", {email: req.body.email}, {}, [], f.slot());
		}, data => {
			//no user found, throw error
			if (!data.length) { 
				return f.fail({
					"status": "401",
					"code": "4001",
					"title": "Invalid User or Password",
					"detail": "Either the user does not exist or the password is incorrect.",
					"meta": {
						"type": "login",
						"error": "invalid"
					}
				}); 
			}

			if (!req.body.password) {
				return f.fail({
					"status": "422",
					"code": "1001",
					"title": "Invalid Input",
					"detail": "You must provide a value for key `password`",
					"meta": {
						"key": "password",
						"rule": "required"
					}
				});
			}

			const user = data[0];
			f.pass(user);
			pwd.hash(req.body.password || "", user._salt, f.slot());
		}, (user, password) => {
			if (user.password === password.toString("base64")) {
				req.session.user = _.extend({}, user);
				delete req.session.user.password;
				delete req.session.user._salt;
				if(!req.query.goto)
					res.json(req.session.user);
			} else {
				return f.fail({
					"status": "401",
					"code": "4001",
					"title": "Invalid User or Password",
					"detail": "Either the user does not exist or the password is incorrect.",
					"meta": {
						"type": "login",
						"error": "invalid"
					}
				}); 
			}

			if (req.query.goto) {
				res.redirect(req.query.goto);
			}
		}).error(this.errorHandler(req, res));
	}

	logout(req, res) {
		req.session.destroy();
		req.session = null;

		if (req.query.goto) {
			res.redirect(req.query.goto);
		} else {
			res.send(200);
		}
	}

	/**
	* Must go through the /api/register endpoint
	* If logged in, can only create a role equal to or less than current
	* If not, cannot specify role
	*/
	register(req, res) {
		const err = [];
		const errorHandler = this.errorHandler(req, res);
		const next = typeof res === "function" && res;

		if (req.session.user) {
			if (req.body.role && !this.storage.inheritRole(req.session.user.role, req.body.role)) {
				err.push({message: `Do not have permission to create the role \`${req.body.role}\`.`})
			}
		} else {
			if (req.body.role) {
				err.push({message: `Do not have permission to create the role \`${req.body.role}\`.`})
			}
		}

		if (!req.body.email) {
			err.push({
				"status": "422",
				"code": "1001",
				"title": "Invalid Input",
				"detail": "You must provide a value for key `email`",
				"meta": {
					"key": "email",
					"rule": "required"
				}
			});
		}

		if (!req.body.password) {
			err.push({
				"status": "422",
				"code": "1001",
				"title": "Invalid Input",
				"detail": "You must provide a value for key `password`",
				"meta": {
					"key": "password",
					"rule": "required"
				}
			});
		}

		if (err.length) { 
			return next ? next(err) : errorHandler(err);
		}

		pwd.hash(req.body.password.toString(), (err, hash) => {
			//add these fields after validation
			req.body._salt = hash[0];
			req.body.password = hash[1];

			// remove all possible confirmation fields
			if(req.body.password2)
				delete req.body.password2;
			if(req.body.confirm_password)
				delete req.body.confirm_password;
			if(req.body.password_confirm)
				delete req.body.password_confirm;

			this.storage.post({
				url: "/data/users",
				session: req.session,
				permission: req.permission,
				body: req.body
			}, (err, data) => {
				if (data) {
					if(data.password) delete data.password;
					if(data._salt) delete data._salt;
				}

				Cluster.console.log(`${this.workerID()}REGISTER`, err, data);

				// TODO headers??
				
				const cb = next ? next : this.response(req, res);
				cb && cb.call(this, err, data);
			});
		});
	}

	update(req, res) {
		const err = [];
		const errorHandler = this.errorHandler(req, res);

		if (!req.session || !req.session.user) {
			err.push({
				"status": "401",
				"code": "4002",
				"title": "Unauthorized",
				"detail": "You must log in before completing this action.",
				"meta": {
					"type": "login",
					"error": "unauthorized"
				}
			});
		}

		if (!req.body.password) {
			err.push({
				"status": "422",
				"code": "1001",
				"title": "Invalid Input",
				"detail": "You must provide a value for key `password`",
				"meta": {
					"key": "password",
					"rule": "required"
				}
			});
		}

		if (err.length) { 
			return errorHandler(err); 
		}

		const user = req.session.user;

		const f = ff(this, function () {
			this.storage.get({
				url: `/data/users/_id/${req.session.user._id}/?single=true`,
				session: req.session
			}, f.slot());
		}, user => {
			f.pass(user);
			pwd.hash(req.body.password, user._salt, f.slot());
		}, (user, password) => {
			// valid password, update details
			if (user.password === password.toString("base64")) {
				delete req.body.password;

				// handle new passwords
				if (req.body.new_password) {
					pwd.hash(req.body.new_password, f.slot());
					delete req.body.new_password;
				}
			} else {
				f.fail({
					"status": "422",
					"code": "1009",
					"title": "Incorrect Password",
					"detail": "Value for key `password` did not match the password in the database.",
					"meta": {
						"key": "password",
						"rule": "match"
					}
				});
			}
		}, function (hash) {
			if (hash) {
				req.body._salt = hash[0];
				req.body.password = hash[1];
			}

			this.storage.post({
				url: `/data/users/_id/${user._id}`,
				body: req.body,
				session: req.session
			}, f.slot());
		}).cb(this.response(req, res));
	}

	forgot(req, res) {
		const f = ff(this, function () {
			this.storage.get({
				url: `/data/users/email/${req.body.email}/?single=true`,
				session: App.adminSession
			}, f.slot());
		}, function({authkey, email}) {
			// only allow sending authkey once every 2 hours
			if (authkey) {
				var key = parseInt(authkey.substring(0, authkey.length - 11), 16);
				const diff = key - Date.now();

				if (diff > 0) {
					const hours = diff / 60 / 60 / 1000;
					return f.fail([{message: `Must wait ${hours.toFixed(1)} hours before sending another recovery email.`}]);
				}
			}

			// make sure key is > Date.now()
			var key = (Date.now() + 2 * 60 * 60 * 1000).toString(16);
			key += randString(); // a touch of randomness

			this.storage.post({
				url: `/data/users/email/${req.body.email}`,
				body: {authkey: key},
				session: App.adminSession
			});

			const templateData = {
				name: this.name,
				key,
				url: this.config.url
			};

			this.mailer.sendMail({
				to: email,
				subject: `Recover Sapling Password for ${this.name}`,
				html: forgotTemplateHTML(templateData)
			}, f.slot());
		}).cb(this.response(req, res));
	}

	recover(req, res) {
		const errorHandler = this.errorHandler(req, res);

		if (!req.query.auth) {
			return errorHandler({
				"status": "422",
				"code": "1001",
				"title": "Invalid Input",
				"detail": "You must provide a value for key `auth`",
				"meta": {
					"key": "auth",
					"rule": "required"
				}
			});
		}

		// could be very invalid keys
		let key = req.query.auth;
		key = parseInt(key.substring(0, key.length - 11), 16);

		const diff = key - Date.now();

		// key has expired
		if (isNaN(diff) || diff <= 0) {
			return errorHandler({
				"status": "401",
				"code": "4003",
				"title": "Authkey Expired",
				"detail": "The authkey has expired and can no longer be used.",
				"meta": {
					"type": "recover",
					"error": "expired"
				}
			});
		}

		// generate a random password
		const newpass = randString();

		const f = ff(this, function () {
			pwd.hash(newpass, f.slot());

			this.storage.get({
				url: `/data/users/authkey/${req.query.auth}/?single=true`,
				session: App.adminSession
			}, f.slot());
		}, function (hash, user) {
			if (!user) {
				return f.fail({
					"status": "401",
					"code": "4004",
					"title": "Authkey Invalid",
					"detail": "The authkey could not be located in the database.",
					"meta": {
						"type": "recover",
						"error": "invalid"
					}
				})
			}

			// update the new password and clear the key
			this.storage.post({
				url: `/data/users/_id/${user._id}`,
				body: {password: hash[1], _salt: hash[0], authkey: ""},
				session: App.adminSession
			}, f.slot());
		}, function () {
			this.renderView(
				path.join(this.config.views, "recover"), 
				{newpass}, req, res,
				err => {
					err && res.send(200, `Your new password is: ${newpass}`);
				}
			);
		}).error(errorHandler);
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
			Cluster.console.error("Error occured during %s %s", req.method && req.method.toUpperCase(), req.url)
			if (self.config.showError) {
				Cluster.console.error(err);
				if (err.stack) Cluster.console.error(err.stack);
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

	reload() {
		Cluster.console.log(`${this.workerID()}\n\n**** RESTARTING ****\n\n`);

		this._restarting = true;		
		this.opts.listen = false;
		this.opts.reload = true;
		App.call(this, this.config.name, this.opts, () => {
			Cluster.console.log(`${this.workerID()}DONE`);
		});
	}
}

App.adminSession = {
	user: { role: "admin" }
};

module.exports = App;
