var riak = require("riak-js");
var ff = require("ff");
var Interface = require("./Interface");

function getKey () {
	Array.prototype.unshift.call(arguments, "db");
	return Array.prototype.join.call(arguments, ":");
}

function getUUID () {
	return (Math.random() * 100000).toString(36).replace(".", "");
}

function realValue (x) {
	var n = +x;
	if (isNaN(n)) {
		return x;
	} else {
		return n;
	}
}

/**
* TODO
* - IN query filter
*/

var Riak = Interface.extend({
	open: function (config, next) {
		this.bucket = config.name;
		this.connection = riak.getClient();
		this.indexes = {};
		this.limit = config.dataLimit || 2e6; //2mil bytes or 2mb

		next && next();
	},

	createTable: function (table, fields, next) {
		this.indexes[table] = {};

		for (var key in fields) {
			if (fields[key].unique) {
				this.indexes[table][key] = true;
			}
		}
	},

	createIndex: function (table, fields, config, next) {
		
	},

	read: function (table, conditions, options, next) {
		console.log("READ", table, conditions, options)
		var f = ff(this, function () {
			if (conditions._id) {
				this.connection.get(this.bucket, getKey(table, conditions._id), {}, f.slot())
			} else if (!Object.keys(conditions).length) {
				var index = {};
				index[table] = 1;
				this.connection.query(this.bucket, index, {}, f.slot());
			} else {
				var indexes = {};
				for (var key in conditions) {
					indexes[table + "_" + key] = realValue(conditions[key]);
				}
				
				this.connection.query(this.bucket, indexes, {}, f.slot());
			}
		}, function (results) {
			// transform an array of keys
			if (Array.isArray(results)) {
				// must not be an array of keys
				if (typeof results[0] !== "string") {
					return f.succeed(results);
				}

				var g = f.group();
				for (var i = 0; i < results.length; ++i) {
					this.connection.get(this.bucket, results[i], g());
				}
			} else {
				var obj = {};
				try {
					obj = JSON.parse(results);
				} catch (err) {}

				f.succeed([obj]);
			}
		}, function (results) {
			// exit early with no results
			if (!results) {
				return f.succeed([]);
			}

			// transform back to JSON
			for (var i = 0; i < results.length; ++i) {
				try {
					results[i] = JSON.parse(results[i]);
				} catch (err) {
					results.splice(i--, 1);
					continue;
				}
			}

			if (options.sort) {
				for (var i = 0; i < options.sort.length; ++i) {
					var sort = options.sort[i];
					var key = sort[0];
					var direction = sort[1];

					function ascSort (a, b) {
						if (a[key] > b[key]) return 1;
						if (a[key] < b[key]) return -1;
						return 0;
					}

					function descSort (a, b) {
						if (a[key] < b[key]) return 1;
						if (a[key] > b[key]) return -1;
						return 0;
					}

					results.sort(direction == -1 ? descSort : ascSort);
				}
			}

			if (options.limit) {
				var skip = parseInt(options.skip, 10) || 0;
				var limit = parseInt(options.limit, 10) || 1;
				results = results.slice(skip, skip + limit);
			}
			
			f.pass(results);
		}).cb(next)
	},

	write: function (table, data, next) {
		// no ID means create a new document
		var create = false;
		if (!data._id) { 
			data._id = getUUID();
			create = true;
		}

		var indexes = {};
		for (var key in data) {
			indexes[table + "_" + key] = realValue(data[key]);
		}

		indexes[table] = 1;

		var f = ff(this, function () {
			this.getSize(f.slot());
		}, function (size) {
			if (size > this.limit) {
				console.error("File size limit of", this.limit, "bytes reached.", size);
				return f.fail([{message: "Maximum data size limit reached."}]);
			}

			if (!this.indexes) { return; }

			var g = f.group();

			for (var key in data) {
				if (this.indexes[table] && this.indexes[table][key]) {
					// make sure no results
					var q = {};
					q[key] = data[key];
					console.log("Check unique", key, data[key])
					this.read(table, q, {}, g());
				}
			}
		}, function (check) {
			if (check) {
				// make sure no results were found
				for (var i = 0; i < check.length; ++i) {
					if (check[i] && check[i].length && check[i][0]._id !== data._id) {
						console.error("Unique constraint voilated", check)
						return f.fail([{message: "Unique constraint violation"}])
					}
				}
			}

			var raw = JSON.stringify(data);
			this.connection.save(
				this.bucket, 
				getKey(table, data._id), // generate key
				raw, // stringify the data
				{index: indexes}, // turn all data keys into 2i
				f.slot()
			);

			// increment the bucket size estimator
			console.log(raw, raw.length);
			this.updateSize(raw.length);
		}, function (results) {
			results = results || [data];
			console.log("Write", results)
			f.pass(results);
		}).cb(next)
	},

	modify: function (table, conditions, data, next) {
		console.log("MODIFY", table, conditions, data);
		var f = ff(this, function () {
			this.read(table, conditions, {}, f.slot());
		}, function (results) {
			var g = f.group();
			var sizeDiff = 0;

			for (var i = 0; i < results.length; ++i) {
				for (var key in data) {
					sizeDiff += (data[key] || '').toString().length - (results[i][key] || '').toString().length;
					results[i][key] = data[key];
				}

				this.write(table, results[i], g())
			}

			this.updateSize(sizeDiff);
		}).cb(next);
	},

	remove: function (table, conditions, next) {
		var f = ff(this, function () {
			this.read(table, conditions, {}, f.slot());
		}, function (results) {
			var g = f.group();
			var sizeDiff = 0;

			for (var i = 0; i < results.length; ++i) {
				this.connection.remove(
					this.bucket,
					getKey(table, results[i]._id),
					g()
				);

				sizeDiff -= JSON.stringify(results[i]).length;
			}

			this.updateSize(sizeDiff);
		}).cb(next);
	},

	increment: function (table, conditions, data, next) {
		var f = ff(this, function () {
			this.read(table, conditions, {}, f.slot());
		}, function (results) {
			var g = f.group();

			for (var i = 0; i < results.length; ++i) {
				for (var key in data) {
					results[i][key] = (results[i][key] || 0) + data[key];
				}

				this.write(table, results[i], g())
			}
		}).cb(next);
	},

	getSize: function (next) {
		this.connection.get(this.bucket, "_size", function (err, size) {
			if (err) {
				size = size || 0;
			}

			this._size = parseInt(size, 10) || 0;
			next && next(null, this._size);
		}.bind(this));
	},

	updateSize: function (diff, next) {
		if (diff === 0) {
			return next && next();
		}

		var f = ff(this, function () {
			if (this._size) {
				f.pass(this._size);
			} else {
				this.getSize(f.slot());
			}
		}, function (size) {
			size += diff;
			if (size < 0) {
				size = 0;
			}

			this.connection.save(this.bucket, "_size", size.toString(), {}, f.slot());
			delete this._size;
		}).cb(next);
	}
});

module.exports = Riak;