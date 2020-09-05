/**
 * User
 * 
 * Built-in user account functionality
 */

'use strict';

class User {
	constructor(App) {
		this.app = App;

		this.app.server.get("/api/logged", this.getLogged.bind(this));
		this.app.server.post("/api/login", this.login.bind(this));
		this.app.server.post("/api/update", this.update.bind(this));
		this.app.server.post("/api/forgot", this.forgot.bind(this));
		this.app.server.get("/api/logout", this.logout.bind(this));
		this.app.server.get("/api/recover", this.recover.bind(this));
		this.app.server.post("/api/register", this.register.bind(this));
	}


	getLogged(req, res) {
		if (req.session && req.session.user) {

			if (req.query.reload) {
				// reload the user object
				this.app.storage.get({
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

	async login(req, res) {

		const url = `/data/users/email/${req.body.email}`;
		const permission = this.app.getRoleForRoute("get", url);

		let data = await this.app.storage.db.read("users", {email: req.body.email}, {}, []);

		//no user found, throw error
		if (!data.length) { 
			return {
				"status": "401",
				"code": "4001",
				"title": "Invalid User or Password",
				"detail": "Either the user does not exist or the password is incorrect.",
				"meta": {
					"type": "login",
					"error": "invalid"
				}
			}; 
		}

		if (!req.body.password) {
			return {
				"status": "422",
				"code": "1001",
				"title": "Invalid Input",
				"detail": "You must provide a value for key `password`",
				"meta": {
					"key": "password",
					"rule": "required"
				}
			};
		}

		const user = data[0];
		const password = await pwd.hash(req.body.password || "", user._salt);

		if (user.password === password.toString("base64")) {
			req.session.user = _.extend({}, user);
			delete req.session.user.password;
			delete req.session.user._salt;
			if(!req.query.goto)
				res.json(req.session.user);
		} else {
			return {
				"status": "401",
				"code": "4001",
				"title": "Invalid User or Password",
				"detail": "Either the user does not exist or the password is incorrect.",
				"meta": {
					"type": "login",
					"error": "invalid"
				}
			}; 
		}

		if (req.query.goto) {
			res.redirect(req.query.goto);
		}
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
		const errorHandler = this.app.errorHandler(req, res);
		const next = typeof res === "function" && res;

		if (req.session.user) {
			if (req.body.role && !this.app.storage.inheritRole(req.session.user.role, req.body.role)) {
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

			this.app.storage.post({
				url: "/data/users",
				session: req.session,
				permission: req.permission,
				body: req.body
			}, (err, data) => {
				if (data) {
					if(data.password) delete data.password;
					if(data._salt) delete data._salt;
				}

				console.log("REGISTER", err, data);

				// TODO headers??
				
				const cb = next ? next : this.app.response(req, res);
				cb && cb.call(this, err, data);
			});
		});
	}

	async update(req, res) {
		const err = [];
		const errorHandler = this.app.errorHandler(req, res);

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

		const user = await this.app.storage.get({
			url: `/data/users/_id/${req.session.user._id}/?single=true`,
			session: req.session
		});
		
		const password = await pwd.hash(req.body.password, user._salt);

		// valid password, update details
		if (user.password === password.toString("base64")) {
			delete req.body.password;

			// handle new passwords
			if (req.body.new_password) {
				const hash = pwd.hash(req.body.new_password);
				delete req.body.new_password;

				req.body._salt = hash[0];
				req.body.password = hash[1];
			}
		} else {
			return {
				"status": "422",
				"code": "1009",
				"title": "Incorrect Password",
				"detail": "Value for key `password` did not match the password in the database.",
				"meta": {
					"key": "password",
					"rule": "match"
				}
			};
		}

		await this.app.storage.post({
			url: `/data/users/_id/${user._id}`,
			body: req.body,
			session: req.session
		});
		
		this.app.response(req, res);
	}

	async forgot(req, res) {
		const {authkey, email} = await this.app.storage.get({
			url: `/data/users/email/${req.body.email}/?single=true`,
			session: App.adminSession
		});

		// only allow sending authkey once every 2 hours
		if (authkey) {
			var key = parseInt(authkey.substring(0, authkey.length - 11), 16);
			const diff = key - Date.now();

			if (diff > 0) {
				const hours = diff / 60 / 60 / 1000;
				return [{message: `Must wait ${hours.toFixed(1)} hours before sending another recovery email.`}];
			}
		}

		// make sure key is > Date.now()
		var key = (Date.now() + 2 * 60 * 60 * 1000).toString(16);
		key += randString(); // a touch of randomness

		await this.app.storage.post({
			url: `/data/users/email/${req.body.email}`,
			body: {authkey: key},
			session: App.adminSession
		});

		const templateData = {
			name: this.app.name,
			key,
			url: this.app.config.url
		};

		await this.app.mailer.sendMail({
			to: email,
			subject: `Recover Sapling Password for ${this.app.name}`,
			html: forgotTemplateHTML(templateData)
		});

		this.app.response(req, res);
	}

	async recover(req, res) {
		const errorHandler = this.app.errorHandler(req, res);

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

		const hash = await pwd.hash(newpass);

		const user = await this.app.storage.get({
			url: `/data/users/authkey/${req.query.auth}/?single=true`,
			session: App.adminSession
		});

		if (!user) {
			return {
				"status": "401",
				"code": "4004",
				"title": "Authkey Invalid",
				"detail": "The authkey could not be located in the database.",
				"meta": {
					"type": "recover",
					"error": "invalid"
				}
			};
		}

		// update the new password and clear the key
		await this.app.storage.post({
			url: `/data/users/_id/${user._id}`,
			body: {password: hash[1], _salt: hash[0], authkey: ""},
			session: App.adminSession
		});
		
		this.app.renderView(
			path.join(this.app.config.views, "recover"), 
			{newpass}, req, res,
			err => {
				err && res.send(200, `Your new password is: ${newpass}`);
			}
		);
	}
};

module.exports = User;
