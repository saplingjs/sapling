;(function(window) {
	var Sapling = {
		get: function (model) {
			return new GetRequest(model);
		},

		post: function (model) {
			return new PostRequest(model);
		}
	};

	function GetRequest (model) {
		this.model = model;
		this.url = "";
		this.query = [];
		this.method = "GET";

		this.xhr = new XMLHttpRequest;
	}

	GetRequest.prototype = {
		where: function (field, value) {
			this.url = field + "/" + value;
			return this;
		},

		range: function (field, from, to) {
			this.url = field + "/" + from + "/" + to;
			return this;
		},

		limit: function (skip, limit) {
			var q = "limit=";
			if (arguments.length == 1) {
				q += skip;
			} else {
				q += skip + "," + limit;
			}

			this.query.push(q);
			return this;
		},

		sort: function (field, direction) {
			direction = direction == 1 ? "asc" : "desc";
			this.query.push("sort=" + field + "," + direction);
			return this;
		},

		single: function () {
			this.query.push("single=true");
			return this;
		},

		end: function (callback) {
			var url = "/data/" + this.model + "/" + this.url;
			if (this.query.length) {
				url += "?" + this.query.join("&");
			}

			this.xhr.open(this.method, url);
			this.xhr.setRequestHeader("Accept", "application/json");
			this.xhr.onreadystatechange = function () {
				if (this.xhr.readyState == 4 && this.xhr.status) {
					var data = null;
					try {
						data = JSON.parse(this.xhr.responseText);
					} catch (e) {
						data = null;
					}

					callback && callback(
						(this.xhr.status === 200 ? null : this.xhr), 
						data
					);
				}
			}.bind(this);

			this.xhr.onerror = function (err) {
				callback && callback({
					status: 0
				});
			}

			this.xhr.send();
			return this;
		}
	};

	function PostRequest (model) {
		this.model = model;
		this.url = "";
		this.method = "POST";

		this.xhr = new XMLHttpRequest;
	}

	PostRequest.prototype = {
		where: function (field, value) {
			this.url = field + "/" + value;
			return this;
		},

		data: function (obj) {
			this.data = obj;
			return this;
		},

		end: function (callback) {
			var url = "/data/" + this.model + "/" + this.url;
			this.xhr.open(this.method, url);
			this.xhr.setRequestHeader("Accept", "application/json");
			this.xhr.setRequestHeader("Content-Type", "application/json");
			this.xhr.onreadystatechange = function () {
				if (this.xhr.readyState == 4 && this.xhr.status) {
					var data = null;
					try {
						data = JSON.parse(this.xhr.responseText);
					} catch (e) {
						data = null;
					}

					callback && callback(
						(this.xhr.status === 200 ? null : this.xhr), 
						data
					);
				}
			}.bind(this);

			this.xhr.onerror = function (err) {
				callback && callback({
					status: 0
				});
			}

			this.xhr.send(JSON.stringify(this.data));
		}
	}

	Sapling.isLogged = function () {
		var xhr = new XMLHttpRequest;
		xhr.open("GET", "/api/logged", false);
		xhr.send();

		var data = false;
		try {
			data = JSON.parse(xhr.responseText);
		} catch (e) {}

		return data;
	};

	Sapling.signUp = function (user) {
		var xhr = new XMLHttpRequest;
		xhr.open("POST", "/api/register", false);
		xhr.send(JSON.stringify(user));

		var data = false;
		try {
			data = JSON.parse(xhr.responseText);
		} catch (e) {}

		return data;
	};

	Sapling.signIn = function (user) {
		var xhr = new XMLHttpRequest;
		xhr.open("POST", "/api/login", false);
		xhr.send(JSON.stringify(user));

		var data = false;
		try {
			data = JSON.parse(xhr.responseText);
		} catch (e) {}

		return data;
	};

	Sapling.signOut = function () {
		var xhr = new XMLHttpRequest;
		xhr.open("GET", "/api/logout", false);
		xhr.send();

		return true;
	};

	Sapling.changePassword = function (old, pass) {
		var xhr = new XMLHttpRequest;
		xhr.open("POST", "/api/update", false);
		xhr.send(JSON.stringify({
			pass: old,
			newpass: pass
		}));

		var data = false;
		try {
			data = JSON.parse(xhr.responseText);
		} catch (e) {}

		return data;
	};

	Sapling.register = Sapling.signUp;
	Sapling.login = Sapling.signIn;
	Sapling.logout = Sapling.signOut;

	window.Sapling = Sapling;
})(window);